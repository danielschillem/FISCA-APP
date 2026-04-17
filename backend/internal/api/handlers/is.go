package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/calc"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ISHandler struct {
	DB *pgxpool.Pool
}

func NewISHandler(db *pgxpool.Pool) *ISHandler { return &ISHandler{DB: db} }

func (h *ISHandler) companyID(r *http.Request) (string, error) {
	id := middleware.GetCompanyID(r)
	if id == "" {
		return "", fmt.Errorf("company not found")
	}
	return id, nil
}

func (h *ISHandler) checkPlan(r *http.Request, allowed ...string) bool {
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

const isCols = `id, company_id, annee, ca, benefice, regime, adhesion_cga,
	is_theorique, mfp_du, is_du, statut, ref, created_at`

func scanIS(row interface{ Scan(...any) error }, d *models.ISDeclaration) error {
	return row.Scan(
		&d.ID, &d.CompanyID, &d.Annee, &d.CA, &d.Benefice, &d.Regime, &d.AdhesionCGA,
		&d.ISTheorique, &d.MFPDu, &d.ISDu, &d.Statut, &d.Ref, &d.CreatedAt,
	)
}

// GET /api/is
func (h *ISHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	q := r.URL.Query()
	annee := q.Get("annee")

	query := `SELECT ` + isCols + ` FROM is_declarations WHERE company_id=$1`
	args := []any{companyID}
	if annee != "" {
		query += ` AND annee=$2`
		args = append(args, annee)
	}
	query += ` ORDER BY annee DESC, created_at DESC`

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []models.ISDeclaration{}
	for rows.Next() {
		var d models.ISDeclaration
		if scanIS(rows, &d) == nil {
			items = append(items, d)
		}
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(len(items)))
	jsonOK(w, items)
}

// POST /api/is [Plan: Enterprise]
func (h *ISHandler) Create(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	if !h.checkPlan(r, "moral_team", "enterprise", "moral_enterprise") {
		jsonError(w, "Le module IS/MFP nécessite le plan Équipe ou Enterprise.", http.StatusPaymentRequired)
		return
	}

	var req struct {
		Annee       int     `json:"annee"`
		CA          float64 `json:"ca"`
		Benefice    float64 `json:"benefice"`
		Regime      string  `json:"regime"`
		AdhesionCGA bool    `json:"adhesion_cga"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Annee < 2000 || req.CA < 0 {
		jsonError(w, "annee (≥ 2000) et ca (≥ 0) requis", http.StatusBadRequest)
		return
	}
	// Normaliser le régime pour correspondre aux clés attendues par CalcMFP :
	// "simplifie" → "RSI" (minimum 300 000 FCFA), tout autre → "RNI" (minimum 1 000 000 FCFA)
	mfpRegime := "RNI"
	if req.Regime == "simplifie" || req.Regime == "RSI" {
		req.Regime = "simplifie"
		mfpRegime = "RSI"
	} else {
		req.Regime = "reel"
	}

	isRes := calc.CalcIS(req.Benefice, req.AdhesionCGA)
	mfpRes := calc.CalcMFP(req.CA, mfpRegime, req.AdhesionCGA)
	isDu := math.Max(isRes.IS, mfpRes.MFPDu)
	ref := fmt.Sprintf("IS-%d-%04d", req.Annee, time.Now().UnixNano()%10000)

	var d models.ISDeclaration
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO is_declarations
		 (company_id, annee, ca, benefice, regime, adhesion_cga, is_theorique, mfp_du, is_du, statut, ref)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'brouillon',$10)
		 RETURNING `+isCols,
		companyID, req.Annee, req.CA, req.Benefice, req.Regime, req.AdhesionCGA,
		isRes.IS, mfpRes.MFPDu, isDu, ref,
	).Scan(
		&d.ID, &d.CompanyID, &d.Annee, &d.CA, &d.Benefice, &d.Regime, &d.AdhesionCGA,
		&d.ISTheorique, &d.MFPDu, &d.ISDu, &d.Statut, &d.Ref, &d.CreatedAt,
	)
	if err != nil {
		jsonError(w, "Erreur création déclaration IS", http.StatusInternalServerError)
		return
	}
	jsonCreated(w, d)
}

// GET /api/is/{id}
func (h *ISHandler) Get(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	var d models.ISDeclaration
	if err := scanIS(h.DB.QueryRow(r.Context(),
		`SELECT `+isCols+` FROM is_declarations WHERE id=$1 AND company_id=$2`, id, companyID,
	), &d); err != nil {
		jsonError(w, "Déclaration IS introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, d)
}

// PATCH /api/is/{id}/valider
func (h *ISHandler) Valider(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.DB.Exec(r.Context(),
		`UPDATE is_declarations SET statut='declare' WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Déclaration IS introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, map[string]string{"statut": "declare"})
}

// DELETE /api/is/{id}
func (h *ISHandler) Delete(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM is_declarations WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Déclaration IS introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/is/{id}/export
func (h *ISHandler) Export(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	var d models.ISDeclaration
	if err := scanIS(h.DB.QueryRow(r.Context(),
		`SELECT `+isCols+` FROM is_declarations WHERE id=$1 AND company_id=$2`, id, companyID,
	), &d); err != nil {
		jsonError(w, "Déclaration IS introuvable", http.StatusNotFound)
		return
	}

	ref := ""
	if d.Ref != nil {
		ref = *d.Ref
	}
	regime := d.Regime
	cga := "Non"
	if d.AdhesionCGA {
		cga = "Oui"
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="IS-%d.csv"`, d.Annee))
	cw := csv.NewWriter(w)
	cw.Write([]string{"Référence", "Année", "CA HT", "Bénéfice", "Régime", "CGA", "IS théorique", "MFP dû", "IS dû", "Statut"})
	cw.Write([]string{
		ref,
		strconv.Itoa(d.Annee),
		strconv.FormatFloat(d.CA, 'f', 0, 64),
		strconv.FormatFloat(d.Benefice, 'f', 0, 64),
		regime, cga,
		strconv.FormatFloat(d.ISTheorique, 'f', 0, 64),
		strconv.FormatFloat(d.MFPDu, 'f', 0, 64),
		strconv.FormatFloat(d.ISDu, 'f', 0, 64),
		d.Statut,
	})
	cw.Flush()
}
