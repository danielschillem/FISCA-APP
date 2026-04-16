package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/calc"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var periodeNoms = map[int]string{
	1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
	5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
	9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
}

type BulletinHandler struct {
	DB *pgxpool.Pool
}

func NewBulletinHandler(db *pgxpool.Pool) *BulletinHandler {
	return &BulletinHandler{DB: db}
}

func (h *BulletinHandler) companyID(r *http.Request) (string, error) {
	id := middleware.GetCompanyID(r)
	if id == "" {
		return "", fmt.Errorf("company not found")
	}
	return id, nil
}

const bulletinCols = `id, company_id, employee_id, mois, annee, periode,
	nom_employe, categorie, salaire_base, anciennete, heures_sup,
	logement, transport, fonction, charges, cotisation,
	brut_total, base_imp, iuts_brut, iuts_net, cot_soc, tpa, fsp, salaire_net, created_at`

func scanBulletin(row interface {
	Scan(...any) error
}, b *models.Bulletin) error {
	return row.Scan(
		&b.ID, &b.CompanyID, &b.EmployeeID, &b.Mois, &b.Annee, &b.Periode,
		&b.NomEmploye, &b.Categorie, &b.SalaireBase, &b.Anciennete, &b.HeuresSup,
		&b.Logement, &b.Transport, &b.Fonction, &b.Charges, &b.Cotisation,
		&b.BrutTotal, &b.BaseImp, &b.IUTSBrut, &b.IUTSNet, &b.CotSoc, &b.TPA, &b.FSP, &b.SalaireNet, &b.CreatedAt,
	)
}

// GET /api/bulletins?mois=4&annee=2026
func (h *BulletinHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	q := r.URL.Query()
	mois := q.Get("mois")
	annee := q.Get("annee")

	countQuery := `SELECT COUNT(*) FROM bulletins WHERE company_id=$1`
	query := `SELECT ` + bulletinCols + ` FROM bulletins WHERE company_id=$1`
	args := []any{companyID}
	idx := 2
	if mois != "" {
		clause := fmt.Sprintf(" AND mois=$%d", idx)
		query += clause
		countQuery += clause
		args = append(args, mois)
		idx++
	}
	if annee != "" {
		clause := fmt.Sprintf(" AND annee=$%d", idx)
		query += clause
		countQuery += clause
		args = append(args, annee)
	}
	query += " ORDER BY annee DESC, mois DESC, nom_employe"

	var total int
	h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []models.Bulletin{}
	for rows.Next() {
		var b models.Bulletin
		if err := scanBulletin(rows, &b); err != nil {
			continue
		}
		items = append(items, b)
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	jsonOK(w, items)
}

// POST /api/bulletins/generate
func (h *BulletinHandler) Generate(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var req struct {
		Mois       int    `json:"mois"`
		Annee      int    `json:"annee"`
		Cotisation string `json:"cotisation"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Mois < 1 || req.Mois > 12 || req.Annee < 2000 {
		jsonError(w, "mois (1-12) et annee requis", http.StatusBadRequest)
		return
	}
	if req.Cotisation == "" {
		req.Cotisation = "CNSS"
	}
	periode := fmt.Sprintf("%s %d", periodeNoms[req.Mois], req.Annee)

	// Supprimer les bulletins existants pour cette période (régénération propre)
	_, _ = h.DB.Exec(r.Context(),
		`DELETE FROM bulletins WHERE company_id=$1 AND mois=$2 AND annee=$3`,
		companyID, req.Mois, req.Annee)

	rows, err := h.DB.Query(r.Context(),
		`SELECT id, nom, categorie, charges, salaire_base, anciennete, heures_sup,
		        logement, transport, fonction, cotisation
		 FROM employees WHERE company_id=$1 ORDER BY nom`,
		companyID)
	if err != nil {
		jsonError(w, "Erreur récupération employés", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var bulletins []models.Bulletin
	for rows.Next() {
		var empID, nom, categorie, empCotisation string
		var charges int
		var salBase, anc, hSup, log, trans, fonc float64
		if err := rows.Scan(&empID, &nom, &categorie, &charges,
			&salBase, &anc, &hSup, &log, &trans, &fonc, &empCotisation); err != nil {
			continue
		}
		// Utiliser la cotisation de l'employé (CNSS ou CARFO) — pas celle du payload
		if empCotisation != "CARFO" {
			empCotisation = "CNSS"
		}
		res := calc.CalcSalarie(calc.SalarieInput{
			SalaireBase: salBase, Anciennete: anc, HeuresSup: hSup,
			Logement: log, Transport: trans, Fonction: fonc,
			Charges: charges, Categorie: categorie, Cotisation: empCotisation,
		})
		var b models.Bulletin
		err = h.DB.QueryRow(r.Context(),
			`INSERT INTO bulletins
			 (company_id, employee_id, mois, annee, periode, nom_employe, categorie,
			  salaire_base, anciennete, heures_sup, logement, transport, fonction, charges, cotisation,
			  brut_total, base_imp, iuts_brut, iuts_net, cot_soc, tpa, fsp, salaire_net)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
			 RETURNING `+bulletinCols,
			companyID, empID, req.Mois, req.Annee, periode, nom, categorie,
			salBase, anc, hSup, log, trans, fonc, charges, empCotisation,
			res.BrutTotal, res.BaseImp, res.IUTSBrut, res.IUTSNet, res.CotSoc, res.TPA, res.FSP, res.SalaireNet,
		).Scan(
			&b.ID, &b.CompanyID, &b.EmployeeID, &b.Mois, &b.Annee, &b.Periode,
			&b.NomEmploye, &b.Categorie, &b.SalaireBase, &b.Anciennete, &b.HeuresSup,
			&b.Logement, &b.Transport, &b.Fonction, &b.Charges, &b.Cotisation,
			&b.BrutTotal, &b.BaseImp, &b.IUTSBrut, &b.IUTSNet, &b.CotSoc, &b.TPA, &b.FSP, &b.SalaireNet, &b.CreatedAt,
		)
		if err == nil {
			bulletins = append(bulletins, b)
		}
	}
	jsonCreated(w, bulletins)
}

// GET /api/bulletins/{id}
func (h *BulletinHandler) Get(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	var b models.Bulletin
	err = h.DB.QueryRow(r.Context(),
		`SELECT `+bulletinCols+` FROM bulletins WHERE id=$1 AND company_id=$2`, id, companyID,
	).Scan(
		&b.ID, &b.CompanyID, &b.EmployeeID, &b.Mois, &b.Annee, &b.Periode,
		&b.NomEmploye, &b.Categorie, &b.SalaireBase, &b.Anciennete, &b.HeuresSup,
		&b.Logement, &b.Transport, &b.Fonction, &b.Charges, &b.Cotisation,
		&b.BrutTotal, &b.BaseImp, &b.IUTSBrut, &b.IUTSNet, &b.CotSoc, &b.TPA, &b.FSP, &b.SalaireNet, &b.CreatedAt,
	)
	if err != nil {
		jsonError(w, "Bulletin introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, b)
}

// DELETE /api/bulletins/{id}
func (h *BulletinHandler) Delete(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM bulletins WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Bulletin introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/bulletins/{id}/export — Export HTML du bulletin de paie (imprimable / "PDF")
// Le client peut utiliser window.print() ou un outil headless pour générer le PDF.
func (h *BulletinHandler) Export(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")

	var b models.Bulletin
	err = h.DB.QueryRow(r.Context(),
		`SELECT `+bulletinCols+` FROM bulletins WHERE id=$1 AND company_id=$2`, id, companyID,
	).Scan(
		&b.ID, &b.CompanyID, &b.EmployeeID, &b.Mois, &b.Annee, &b.Periode,
		&b.NomEmploye, &b.Categorie, &b.SalaireBase, &b.Anciennete, &b.HeuresSup,
		&b.Logement, &b.Transport, &b.Fonction, &b.Charges, &b.Cotisation,
		&b.BrutTotal, &b.BaseImp, &b.IUTSBrut, &b.IUTSNet, &b.CotSoc, &b.TPA, &b.FSP, &b.SalaireNet, &b.CreatedAt,
	)
	if err != nil {
		jsonError(w, "Bulletin introuvable", http.StatusNotFound)
		return
	}

	var nomEntreprise, ifu string
	h.DB.QueryRow(r.Context(),
		`SELECT COALESCE(nom,''), COALESCE(ifu,'') FROM companies WHERE id=$1`, companyID,
	).Scan(&nomEntreprise, &ifu)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Disposition",
		fmt.Sprintf(`inline; filename="BULLETIN-%s-%s-%d%02d.html"`,
			b.NomEmploye, nomEntreprise, b.Annee, b.Mois))

	fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bulletin de paie — %s — %s %d</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:0;padding:20px;color:#222}
  h1{font-size:16px;margin-bottom:4px}h2{font-size:13px;color:#555}
  table{width:100%%;border-collapse:collapse;margin-top:12px}
  th{background:#1a3c2e;color:#fff;padding:6px 8px;text-align:left;font-size:11px}
  td{border-bottom:1px solid #eee;padding:5px 8px}
  .total{font-weight:bold;background:#f0f7f4}
  .header{display:flex;justify-content:space-between;border-bottom:2px solid #1a3c2e;padding-bottom:8px;margin-bottom:12px}
  @media print{body{padding:0}}
</style>
</head>
<body>
<div class="header">
  <div><h1>FISCA — Bulletin de paie</h1><h2>%s</h2><p>IFU : %s</p></div>
  <div style="text-align:right"><p><strong>Période : %s %d</strong></p><p>Émis le : %s</p></div>
</div>
<table>
  <tr><th colspan="2">Employé : %s</th><th>Catégorie</th><th>Charges</th><th>Régime</th></tr>
  <tr><td colspan="2"></td><td>%s</td><td>%d</td><td>%s</td></tr>
</table>
<table style="margin-top:16px">
  <tr><th>Élément</th><th style="text-align:right">Montant (FCFA)</th></tr>
  <tr><td>Salaire de base</td><td style="text-align:right">%s</td></tr>
  <tr><td>Ancienneté</td><td style="text-align:right">%s</td></tr>
  <tr><td>Heures supplémentaires</td><td style="text-align:right">%s</td></tr>
  <tr><td>Logement</td><td style="text-align:right">%s</td></tr>
  <tr><td>Transport</td><td style="text-align:right">%s</td></tr>
  <tr><td>Fonction</td><td style="text-align:right">%s</td></tr>
  <tr class="total"><td><strong>Brut total</strong></td><td style="text-align:right"><strong>%s</strong></td></tr>
  <tr><td style="color:#c00">Cotisation sociale (%s)</td><td style="text-align:right;color:#c00">-%s</td></tr>
  <tr><td style="color:#c00">IUTS net</td><td style="text-align:right;color:#c00">-%s</td></tr>
  <tr class="total" style="background:#d4edda"><td><strong>Salaire net à payer</strong></td><td style="text-align:right"><strong>%s</strong></td></tr>
</table>
<table style="margin-top:16px">
  <tr><th colspan="2">Détail cotisations employeur</th></tr>
  <tr><td>TPA (3%%)</td><td style="text-align:right">%s FCFA</td></tr>
  <tr><td>Base imposable</td><td style="text-align:right">%s FCFA</td></tr>
</table>
<p style="margin-top:24px;font-size:10px;color:#888">Document généré par FISCA. Confidentiel.</p>
</body></html>`,
		b.NomEmploye, nomEntreprise, b.Mois,
		nomEntreprise, ifu, periodeNoms[b.Mois], b.Annee,
		b.CreatedAt.Format("02/01/2006"),
		b.NomEmploye, b.Categorie, b.Charges, b.Cotisation,
		fmtFCFA(b.SalaireBase), fmtFCFA(b.Anciennete), fmtFCFA(b.HeuresSup),
		fmtFCFA(b.Logement), fmtFCFA(b.Transport), fmtFCFA(b.Fonction),
		fmtFCFA(b.BrutTotal),
		b.Cotisation, fmtFCFA(b.CotSoc), fmtFCFA(b.IUTSNet),
		fmtFCFA(b.SalaireNet),
		fmtFCFA(b.TPA), fmtFCFA(b.BaseImp),
	)
}

func fmtFCFA(v float64) string {
	// Format entier avec séparateur de milliers (espace)
	s := fmt.Sprintf("%.0f", v)
	n := len(s)
	if n <= 3 {
		return s
	}
	result := make([]byte, 0, n+(n-1)/3)
	rest := n % 3
	if rest == 0 {
		rest = 3
	}
	result = append(result, s[:rest]...)
	for i := rest; i < n; i += 3 {
		result = append(result, ' ')
		result = append(result, s[i:i+3]...)
	}
	return string(result)
}
