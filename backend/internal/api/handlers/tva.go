package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TVAHandler struct {
	DB *pgxpool.Pool
}

func NewTVAHandler(db *pgxpool.Pool) *TVAHandler {
	return &TVAHandler{DB: db}
}

func (h *TVAHandler) companyID(r *http.Request) (string, error) {
	id := middleware.GetCompanyID(r)
	if id == "" {
		return "", fmt.Errorf("company not found")
	}
	return id, nil
}

func (h *TVAHandler) checkPlan(r *http.Request, allowed ...string) bool {
	userID := middleware.GetUserID(r)
	var plan string
	h.DB.QueryRow(r.Context(), `SELECT plan FROM users WHERE id=$1`, userID).Scan(&plan)
	for _, p := range allowed {
		if plan == p {
			return true
		}
	}
	return false
}

const tvaCols = `id, company_id, periode, mois, annee,
	ca_ttc, ca_ht, tva_collectee, tva_deductible, tva_nette,
	statut, ref, created_at`

func scanTVA(row interface{ Scan(...any) error }, d *models.TVADeclaration) error {
	return row.Scan(
		&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
		&d.CaTTC, &d.CaHT, &d.TVACollectee, &d.TVADeductible, &d.TVANette,
		&d.Statut, &d.Ref, &d.CreatedAt,
	)
}

// GET /api/tva
func (h *TVAHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	q := r.URL.Query()
	mois := q.Get("mois")
	annee := q.Get("annee")

	countQuery := `SELECT COUNT(*) FROM tva_declarations WHERE company_id=$1`
	query := `SELECT ` + tvaCols + ` FROM tva_declarations WHERE company_id=$1`
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
	query += " ORDER BY annee DESC, mois DESC"

	var total int
	h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []models.TVADeclaration{}
	for rows.Next() {
		var d models.TVADeclaration
		if err := scanTVA(rows, &d); err != nil {
			continue
		}
		items = append(items, d)
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	jsonOK(w, items)
}

// POST /api/tva [Plan: Pro+]
func (h *TVAHandler) Create(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	if !h.checkPlan(r, "pro", "physique_pro", "enterprise", "moral_team", "moral_enterprise") {
		jsonError(w, "Le module TVA nécessite le plan Pro ou Enterprise.", http.StatusPaymentRequired)
		return
	}

	var req struct {
		Mois          int     `json:"mois"`
		Annee         int     `json:"annee"`
		CaTTC         float64 `json:"ca_ttc"`
		CaHT          float64 `json:"ca_ht"`
		TVACollectee  float64 `json:"tva_collectee"`
		TVADeductible float64 `json:"tva_deductible"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Mois < 1 || req.Mois > 12 || req.Annee < 2000 {
		jsonError(w, "mois (1-12) et annee requis", http.StatusBadRequest)
		return
	}

	periode := fmt.Sprintf("%s %d", periodeNoms[req.Mois], req.Annee)
	tvaNette := req.TVACollectee - req.TVADeductible
	now := time.Now()
	ref := fmt.Sprintf("TVA-%d%02d-%04d", req.Annee, req.Mois, now.UnixNano()%10000)

	var d models.TVADeclaration
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO tva_declarations
		 (company_id, periode, mois, annee, ca_ttc, ca_ht, tva_collectee, tva_deductible, tva_nette, statut, ref)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'brouillon',$10)
		 RETURNING `+tvaCols,
		companyID, periode, req.Mois, req.Annee,
		req.CaTTC, req.CaHT, req.TVACollectee, req.TVADeductible, tvaNette, ref,
	).Scan(
		&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
		&d.CaTTC, &d.CaHT, &d.TVACollectee, &d.TVADeductible, &d.TVANette,
		&d.Statut, &d.Ref, &d.CreatedAt,
	)
	if err != nil {
		jsonError(w, "Erreur création déclaration TVA", http.StatusInternalServerError)
		return
	}
	jsonCreated(w, d)
}

// GET /api/tva/{id}
func (h *TVAHandler) Get(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	var d models.TVADeclaration
	err = h.DB.QueryRow(r.Context(),
		`SELECT `+tvaCols+` FROM tva_declarations WHERE id=$1 AND company_id=$2`, id, companyID,
	).Scan(
		&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
		&d.CaTTC, &d.CaHT, &d.TVACollectee, &d.TVADeductible, &d.TVANette,
		&d.Statut, &d.Ref, &d.CreatedAt,
	)
	if err != nil {
		jsonError(w, "Déclaration TVA introuvable", http.StatusNotFound)
		return
	}

	// Charger les lignes
	lRows, err := h.DB.Query(r.Context(),
		`SELECT id, declaration_id, type_op, description, montant_ht, taux_tva, montant_tva, montant_ttc
		 FROM tva_lignes WHERE declaration_id=$1`, id)
	if err == nil {
		defer lRows.Close()
		for lRows.Next() {
			var l models.TVALigne
			if err := lRows.Scan(&l.ID, &l.DeclarationID, &l.TypeOp, &l.Description,
				&l.MontantHT, &l.TauxTVA, &l.MontantTVA, &l.MontantTTC); err == nil {
				d.Lignes = append(d.Lignes, l)
			}
		}
	}
	jsonOK(w, d)
}

// PUT /api/tva/{id}
func (h *TVAHandler) Update(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")

	var req struct {
		Statut        string  `json:"statut"`
		CaTTC         float64 `json:"ca_ttc"`
		CaHT          float64 `json:"ca_ht"`
		TVACollectee  float64 `json:"tva_collectee"`
		TVADeductible float64 `json:"tva_deductible"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	tvaNette := req.TVACollectee - req.TVADeductible

	var d models.TVADeclaration
	err = h.DB.QueryRow(r.Context(),
		`UPDATE tva_declarations
		 SET ca_ttc=$1, ca_ht=$2, tva_collectee=$3, tva_deductible=$4, tva_nette=$5, statut=$6
		 WHERE id=$7 AND company_id=$8
		 RETURNING `+tvaCols,
		req.CaTTC, req.CaHT, req.TVACollectee, req.TVADeductible, tvaNette, req.Statut,
		id, companyID,
	).Scan(
		&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
		&d.CaTTC, &d.CaHT, &d.TVACollectee, &d.TVADeductible, &d.TVANette,
		&d.Statut, &d.Ref, &d.CreatedAt,
	)
	if err != nil {
		jsonError(w, "Déclaration TVA introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, d)
}

// DELETE /api/tva/{id}
func (h *TVAHandler) Delete(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM tva_declarations WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Déclaration TVA introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/tva/{id}/lignes
func (h *TVAHandler) AddLigne(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")

	// Vérifier appartenance
	var exists bool
	_ = h.DB.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM tva_declarations WHERE id=$1 AND company_id=$2)`,
		id, companyID).Scan(&exists)
	if !exists {
		jsonError(w, "Déclaration TVA introuvable", http.StatusNotFound)
		return
	}

	var req struct {
		TypeOp      string  `json:"type_op"`
		Description string  `json:"description"`
		MontantHT   float64 `json:"montant_ht"`
		TauxTVA     float64 `json:"taux_tva"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if req.TypeOp != "vente" && req.TypeOp != "achat" {
		jsonError(w, "type_op doit être 'vente' ou 'achat'", http.StatusBadRequest)
		return
	}
	if req.TauxTVA == 0 {
		req.TauxTVA = 18.00
	}
	montantTVA := math.Round(req.MontantHT*(req.TauxTVA/100)*100) / 100
	montantTTC := req.MontantHT + montantTVA

	var l models.TVALigne
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO tva_lignes (declaration_id, type_op, description, montant_ht, taux_tva, montant_tva, montant_ttc)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING id, declaration_id, type_op, description, montant_ht, taux_tva, montant_tva, montant_ttc`,
		id, req.TypeOp, req.Description, req.MontantHT, req.TauxTVA, montantTVA, montantTTC,
	).Scan(&l.ID, &l.DeclarationID, &l.TypeOp, &l.Description,
		&l.MontantHT, &l.TauxTVA, &l.MontantTVA, &l.MontantTTC)
	if err != nil {
		jsonError(w, "Erreur ajout ligne TVA", http.StatusInternalServerError)
		return
	}

	// Recalculer les totaux depuis toutes les lignes
	h.recalcTotaux(r, id)
	jsonCreated(w, l)
}

// DELETE /api/tva/{id}/lignes/{lid}
func (h *TVAHandler) DeleteLigne(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	lid := chi.URLParam(r, "lid")

	var exists bool
	_ = h.DB.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM tva_declarations WHERE id=$1 AND company_id=$2)`,
		id, companyID).Scan(&exists)
	if !exists {
		jsonError(w, "Déclaration TVA introuvable", http.StatusNotFound)
		return
	}

	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM tva_lignes WHERE id=$1 AND declaration_id=$2`, lid, id)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Ligne introuvable", http.StatusNotFound)
		return
	}

	h.recalcTotaux(r, id)
	w.WriteHeader(http.StatusNoContent)
}

// recalcTotaux recalcule ca_ttc, ca_ht, tva_collectee, tva_deductible, tva_nette depuis les lignes.
func (h *TVAHandler) recalcTotaux(r *http.Request, declarationID string) {
	_, _ = h.DB.Exec(r.Context(), `
		UPDATE tva_declarations SET
			ca_ht          = COALESCE((SELECT SUM(montant_ht)  FROM tva_lignes WHERE declaration_id=$1 AND type_op='vente'),0),
			ca_ttc         = COALESCE((SELECT SUM(montant_ttc) FROM tva_lignes WHERE declaration_id=$1 AND type_op='vente'),0),
			tva_collectee  = COALESCE((SELECT SUM(montant_tva) FROM tva_lignes WHERE declaration_id=$1 AND type_op='vente'),0),
			tva_deductible = COALESCE((SELECT SUM(montant_tva) FROM tva_lignes WHERE declaration_id=$1 AND type_op='achat'),0),
			tva_nette      = COALESCE((SELECT SUM(montant_tva) FROM tva_lignes WHERE declaration_id=$1 AND type_op='vente'),0)
			            - COALESCE((SELECT SUM(montant_tva) FROM tva_lignes WHERE declaration_id=$1 AND type_op='achat'),0)
		WHERE id=$1`, declarationID)
}

// GET /api/tva/{id}/export - Export CSV format DGI-BF
func (h *TVAHandler) Export(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")

	var d models.TVADeclaration
	err = h.DB.QueryRow(r.Context(),
		`SELECT `+tvaCols+` FROM tva_declarations WHERE id=$1 AND company_id=$2`, id, companyID,
	).Scan(
		&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
		&d.CaTTC, &d.CaHT, &d.TVACollectee, &d.TVADeductible, &d.TVANette,
		&d.Statut, &d.Ref, &d.CreatedAt,
	)
	if err != nil {
		jsonError(w, "Déclaration TVA introuvable", http.StatusNotFound)
		return
	}

	var nomEntreprise, ifu string
	h.DB.QueryRow(r.Context(),
		`SELECT COALESCE(nom,''), COALESCE(ifu,'') FROM companies WHERE id=$1`, companyID,
	).Scan(&nomEntreprise, &ifu)

	ref := ""
	if d.Ref != nil {
		ref = *d.Ref
	}

	filename := fmt.Sprintf("FISCA-TVA-%d%02d-%s.csv", d.Annee, d.Mois, ref)
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Write([]byte("\xEF\xBB\xBF")) // BOM UTF-8

	fmt.Fprintf(w, "REFERENCE;ENTREPRISE;IFU;PERIODE;MOIS;ANNEE;CA_HT;CA_TTC;TVA_COLLECTEE;TVA_DEDUCTIBLE;TVA_NETTE;STATUT\n")
	fmt.Fprintf(w, "%s;%s;%s;%s;%d;%d;%.2f;%.2f;%.2f;%.2f;%.2f;%s\n",
		ref, nomEntreprise, ifu, d.Periode, d.Mois, d.Annee,
		d.CaHT, d.CaTTC, d.TVACollectee, d.TVADeductible, d.TVANette, d.Statut,
	)

	// Lignes détail
	lRows, err := h.DB.Query(r.Context(),
		`SELECT type_op, description, montant_ht, taux_tva, montant_tva, montant_ttc
		 FROM tva_lignes WHERE declaration_id=$1 ORDER BY type_op`, id)
	if err == nil {
		defer lRows.Close()
		fmt.Fprintf(w, "\nTYPE;DESCRIPTION;MONTANT_HT;TAUX_TVA;MONTANT_TVA;MONTANT_TTC\n")
		for lRows.Next() {
			var typeOp, desc string
			var ht, taux, tva, ttc float64
			if lRows.Scan(&typeOp, &desc, &ht, &taux, &tva, &ttc) == nil {
				fmt.Fprintf(w, "%s;%s;%.2f;%.2f;%.2f;%.2f\n", typeOp, desc, ht, taux, tva, ttc)
			}
		}
	}
}
