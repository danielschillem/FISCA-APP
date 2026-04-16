package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/calc"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DeclarationHandler struct {
	DB *pgxpool.Pool
}

func NewDeclarationHandler(db *pgxpool.Pool) *DeclarationHandler {
	return &DeclarationHandler{DB: db}
}

func (h *DeclarationHandler) companyID(r *http.Request) (string, error) {
	id := middleware.GetCompanyID(r)
	if id == "" {
		return "", fmt.Errorf("company not found")
	}
	return id, nil
}

// GET /api/declarations?page=1&limit=100
func (h *DeclarationHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	page, limit := 1, 100
	if p := r.URL.Query().Get("page"); p != "" {
		if v, e := strconv.Atoi(p); e == nil && v > 0 {
			page = v
		}
	}
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, e := strconv.Atoi(l); e == nil && v > 0 && v <= 200 {
			limit = v
		}
	}
	offset := (page - 1) * limit

	// Total pour pagination
	var total int
	h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM declarations WHERE company_id=$1`, companyID).Scan(&total)

	rows, err := h.DB.Query(r.Context(),
		`SELECT id, company_id, periode, mois, annee, nb_salaries,
		        brut_total, iuts_total, tpa_total, css_total, total,
		        statut, ref, date_depot, created_at
		 FROM declarations WHERE company_id=$1 ORDER BY annee DESC, mois DESC
		 LIMIT $2 OFFSET $3`,
		companyID, limit, offset,
	)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	decls := []models.Declaration{}
	for rows.Next() {
		var d models.Declaration
		if err := rows.Scan(&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
			&d.NbSalarie, &d.BrutTotal, &d.IUTSTotal, &d.TPATotal,
			&d.CSSTotal, &d.Total, &d.Statut, &d.Ref, &d.DateDepot, &d.CreatedAt,
		); err != nil {
			continue
		}
		decls = append(decls, d)
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	w.Header().Set("X-Page", strconv.Itoa(page))
	w.Header().Set("X-Limit", strconv.Itoa(limit))
	jsonOK(w, decls)
}

// GET /api/declarations/{id}
func (h *DeclarationHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	var d models.Declaration
	err = h.DB.QueryRow(r.Context(),
		`SELECT id, company_id, periode, mois, annee, nb_salaries,
		        brut_total, iuts_total, tpa_total, css_total, total,
		        statut, ref, date_depot, created_at
		 FROM declarations WHERE id=$1 AND company_id=$2`,
		id, companyID,
	).Scan(&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
		&d.NbSalarie, &d.BrutTotal, &d.IUTSTotal, &d.TPATotal,
		&d.CSSTotal, &d.Total, &d.Statut, &d.Ref, &d.DateDepot, &d.CreatedAt)
	if err != nil {
		jsonError(w, "Déclaration introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, d)
}

// POST /api/declarations — Calcul + enregistrement à partir des employés
func (h *DeclarationHandler) Create(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var req struct {
		Mois       int    `json:"mois"`
		Annee      int    `json:"annee"`
		Cotisation string `json:"cotisation"` // "CNSS" | "CARFO" (ignoré, utilisé par employé)
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if req.Mois < 1 || req.Mois > 12 {
		jsonError(w, "Mois invalide : doit être entre 1 et 12", http.StatusBadRequest)
		return
	}
	if req.Annee < 2000 || req.Annee > 2100 {
		jsonError(w, "Année invalide", http.StatusBadRequest)
		return
	}

	// Récupérer les employés avec leur cotisation individuelle
	rows, err := h.DB.Query(r.Context(),
		`SELECT salaire_base, anciennete, heures_sup, logement, transport, fonction, charges, cotisation
		 FROM employees WHERE company_id=$1`, companyID)
	if err != nil {
		jsonError(w, "Erreur récupération employés", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var brutTotal, iutsTotal, tpaTotal, cssTotal float64
	nbSalaries := 0
	for rows.Next() {
		var e calc.SalarieInput
		if err := rows.Scan(&e.SalaireBase, &e.Anciennete, &e.HeuresSup,
			&e.Logement, &e.Transport, &e.Fonction, &e.Charges, &e.Cotisation); err != nil {
			continue
		}
		if e.Cotisation != "CARFO" {
			e.Cotisation = "CNSS"
		}
		res := calc.CalcSalarie(e)
		brutTotal += res.BrutTotal
		iutsTotal += res.IUTSNet
		tpaTotal += res.TPA
		cssTotal += res.CotSoc
		nbSalaries++
	}
	total := iutsTotal + tpaTotal

	periodeMap := map[int]string{
		1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
		5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
		9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
	}
	periode := fmt.Sprintf("%s %d", periodeMap[req.Mois], req.Annee)

	now := time.Now()
	ref := fmt.Sprintf("FISCA-%d%02d-%04d", req.Annee, req.Mois, now.UnixNano()%10000)

	// Délai légal BF : 20 du mois suivant la période (IUTS/CSS)
	// time.Month(mois+1) est normalisé par Go (décembre+1 = janvier N+1)
	deadline := time.Date(req.Annee, time.Month(req.Mois+1), 20, 23, 59, 59, 0, time.UTC)
	statut := "ok"
	if now.UTC().After(deadline) {
		statut = "retard"
	}

	var d models.Declaration
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO declarations
		 (company_id, periode, mois, annee, nb_salaries,
		  brut_total, iuts_total, tpa_total, css_total, total,
		  statut, ref, date_depot)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		 RETURNING id, company_id, periode, mois, annee, nb_salaries,
		   brut_total, iuts_total, tpa_total, css_total, total,
		   statut, ref, date_depot, created_at`,
		companyID, periode, req.Mois, req.Annee, nbSalaries,
		brutTotal, iutsTotal, tpaTotal, cssTotal, total,
		statut, ref, now,
	).Scan(&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee, &d.NbSalarie,
		&d.BrutTotal, &d.IUTSTotal, &d.TPATotal, &d.CSSTotal, &d.Total,
		&d.Statut, &d.Ref, &d.DateDepot, &d.CreatedAt)
	if err != nil {
		jsonError(w, "Erreur création déclaration", http.StatusInternalServerError)
		return
	}
	jsonCreated(w, d)
}

// DELETE /api/declarations/{id}
func (h *DeclarationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM declarations WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Déclaration introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/declarations/{id}/export — Export DIPE format DGI Burkina Faso
func (h *DeclarationHandler) Export(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var d models.Declaration
	err = h.DB.QueryRow(r.Context(),
		`SELECT id, company_id, periode, mois, annee, nb_salaries,
		        brut_total, iuts_total, tpa_total, css_total, total,
		        statut, ref, date_depot, created_at
		 FROM declarations WHERE id=$1 AND company_id=$2`,
		id, companyID,
	).Scan(&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
		&d.NbSalarie, &d.BrutTotal, &d.IUTSTotal, &d.TPATotal,
		&d.CSSTotal, &d.Total, &d.Statut, &d.Ref, &d.DateDepot, &d.CreatedAt)
	if err != nil {
		jsonError(w, "Déclaration introuvable", http.StatusNotFound)
		return
	}

	// Informations entreprise
	var nom, ifu, rc, adresse string
	h.DB.QueryRow(r.Context(),
		`SELECT COALESCE(nom,''), COALESCE(ifu,''), COALESCE(rc,''), COALESCE(adresse,'')
		 FROM companies WHERE id=$1`, companyID,
	).Scan(&nom, &ifu, &rc, &adresse)

	// Employés actuels (pour détail DIPE)
	rows, err := h.DB.Query(r.Context(),
		`SELECT nom, categorie, cotisation, charges,
		        salaire_base, anciennete, heures_sup, logement, transport, fonction
		 FROM employees WHERE company_id=$1 ORDER BY nom`,
		companyID,
	)
	if err != nil {
		jsonError(w, "Erreur récupération employés", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	ref := ""
	if d.Ref != nil {
		ref = *d.Ref
	}

	filename := fmt.Sprintf("DIPE-IUTS-TPA-%d%02d-%s.csv", d.Annee, d.Mois, ref)
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Write([]byte("\xEF\xBB\xBF")) // BOM UTF-8

	cw := csv.NewWriter(w)
	cw.Comma = ';'

	// ── Entête DIPE ──
	_ = cw.Write([]string{"FISCA — DIPE IUTS/TPA/CSS", "Burkina Faso", "CGI 2025"})
	_ = cw.Write([]string{""})
	_ = cw.Write([]string{"ENTREPRISE", nom})
	_ = cw.Write([]string{"IFU", ifu})
	_ = cw.Write([]string{"RC", rc})
	_ = cw.Write([]string{"ADRESSE", adresse})
	_ = cw.Write([]string{"PERIODE", d.Periode})
	_ = cw.Write([]string{"REFERENCE", ref})
	_ = cw.Write([]string{"DATE GENERATION", time.Now().Format("02/01/2006 15:04")})
	_ = cw.Write([]string{""})

	// ── Tableau récapitulatif ──
	_ = cw.Write([]string{"=== RECAPITULATIF ==="})
	_ = cw.Write([]string{"NB SALARIES", strconv.Itoa(d.NbSalarie)})
	_ = cw.Write([]string{"MASSE SALARIALE BRUTE", fmt.Sprintf("%.0f", d.BrutTotal)})
	_ = cw.Write([]string{"IUTS TOTAL", fmt.Sprintf("%.0f", d.IUTSTotal)})
	_ = cw.Write([]string{"TPA TOTAL (3%)", fmt.Sprintf("%.0f", d.TPATotal)})
	_ = cw.Write([]string{"CSS SALARIALE", fmt.Sprintf("%.0f", d.CSSTotal)})
	_ = cw.Write([]string{"TOTAL DGI (IUTS+TPA)", fmt.Sprintf("%.0f", d.Total)})
	_ = cw.Write([]string{"STATUT", d.Statut})
	_ = cw.Write([]string{""})

	// ── Détail par employé ──
	_ = cw.Write([]string{"=== DETAIL PAR EMPLOYE ==="})
	_ = cw.Write([]string{
		"NOM", "CATEGORIE", "COTISATION", "CHARGES", "SALAIRE_BASE",
		"BRUT_TOTAL", "BASE_IMPOSABLE", "IUTS_BRUT", "ABATT_FAMILIAL",
		"IUTS_NET", "CSS_SALARIE", "TPA_PATRONAL", "NET_A_PAYER",
	})

	for rows.Next() {
		var e calc.SalarieInput
		var empNom string
		if err := rows.Scan(&empNom, &e.Categorie, &e.Cotisation, &e.Charges,
			&e.SalaireBase, &e.Anciennete, &e.HeuresSup,
			&e.Logement, &e.Transport, &e.Fonction,
		); err != nil {
			continue
		}
		if e.Cotisation != "CARFO" {
			e.Cotisation = "CNSS"
		}
		res := calc.CalcSalarie(e)

		_ = cw.Write([]string{
			empNom, e.Categorie, e.Cotisation, strconv.Itoa(e.Charges),
			fmt.Sprintf("%.0f", e.SalaireBase),
			fmt.Sprintf("%.0f", res.BrutTotal),
			fmt.Sprintf("%.0f", res.BaseImp),
			fmt.Sprintf("%.0f", res.IUTSBrut),
			fmt.Sprintf("%.0f", res.AbattFam),
			fmt.Sprintf("%.0f", res.IUTSNet),
			fmt.Sprintf("%.0f", res.CotSoc),
			fmt.Sprintf("%.0f", res.TPA),
			fmt.Sprintf("%.0f", res.NetAPayer),
		})
	}

	// ── Pied de page ──
	_ = cw.Write([]string{""})
	_ = cw.Write([]string{"Généré par FISCA — Plateforme Fiscale BF", "www.fisca.bf"})
	cw.Flush()
}
