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

type PatenteHandler struct {
	DB *pgxpool.Pool
}

func NewPatenteHandler(db *pgxpool.Pool) *PatenteHandler { return &PatenteHandler{DB: db} }

func (h *PatenteHandler) companyID(r *http.Request) (string, error) {
	id := middleware.GetCompanyID(r)
	if id == "" {
		return "", fmt.Errorf("company not found")
	}
	return id, nil
}

func (h *PatenteHandler) checkPlan(r *http.Request, allowed ...string) bool {
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

const patenteCols = `id, company_id, annee, ca, valeur_locative,
	droit_fixe, droit_prop, total_patente, statut, ref, created_at`

func scanPatente(row interface{ Scan(...any) error }, d *models.PatenteDeclaration) error {
	return row.Scan(
		&d.ID, &d.CompanyID, &d.Annee, &d.CA, &d.ValeurLocative,
		&d.DroitFixe, &d.DroitProp, &d.TotalPatente, &d.Statut, &d.Ref, &d.CreatedAt,
	)
}

// GET /api/patente
func (h *PatenteHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	q := r.URL.Query()
	annee := q.Get("annee")

	query := `SELECT ` + patenteCols + ` FROM patente_declarations WHERE company_id=$1`
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

	items := []models.PatenteDeclaration{}
	for rows.Next() {
		var d models.PatenteDeclaration
		if scanPatente(rows, &d) == nil {
			items = append(items, d)
		}
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(len(items)))
	jsonOK(w, items)
}

// POST /api/patente [Plan: Enterprise]
func (h *PatenteHandler) Create(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	if !h.checkPlan(r, "moral_team", "enterprise", "moral_enterprise") {
		jsonError(w, "Le module Patente nécessite le plan Équipe ou Enterprise.", http.StatusPaymentRequired)
		return
	}

	var req struct {
		Annee          int     `json:"annee"`
		CA             float64 `json:"ca"`
		ValeurLocative float64 `json:"valeur_locative"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Annee < 2000 || req.CA <= 0 {
		jsonError(w, "annee (≥ 2000) et ca (> 0) requis", http.StatusBadRequest)
		return
	}

	res := calc.CalcPatente(req.CA, req.ValeurLocative)
	ref := fmt.Sprintf("PAT-%d-%04d", req.Annee, time.Now().UnixNano()%10000)

	var d models.PatenteDeclaration
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO patente_declarations
		 (company_id, annee, ca, valeur_locative, droit_fixe, droit_prop, total_patente, statut, ref)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,'brouillon',$8)
		 RETURNING `+patenteCols,
		companyID, req.Annee, res.CA, res.ValeurLocative,
		res.DroitFixe, res.DroitProp, res.TotalPatente, ref,
	).Scan(
		&d.ID, &d.CompanyID, &d.Annee, &d.CA, &d.ValeurLocative,
		&d.DroitFixe, &d.DroitProp, &d.TotalPatente, &d.Statut, &d.Ref, &d.CreatedAt,
	)
	if err != nil {
		jsonError(w, "Erreur création déclaration Patente", http.StatusInternalServerError)
		return
	}
	jsonCreated(w, d)
}

// GET /api/patente/{id}
func (h *PatenteHandler) Get(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	var d models.PatenteDeclaration
	if err := scanPatente(h.DB.QueryRow(r.Context(),
		`SELECT `+patenteCols+` FROM patente_declarations WHERE id=$1 AND company_id=$2`, id, companyID,
	), &d); err != nil {
		jsonError(w, "Déclaration Patente introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, d)
}

// PATCH /api/patente/{id}/valider
func (h *PatenteHandler) Valider(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.DB.Exec(r.Context(),
		`UPDATE patente_declarations SET statut='declare' WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Déclaration Patente introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, map[string]string{"statut": "declare"})
}

// DELETE /api/patente/{id}
func (h *PatenteHandler) Delete(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM patente_declarations WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Déclaration Patente introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/patente/{id}/export
func (h *PatenteHandler) Export(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	var d models.PatenteDeclaration
	if err := scanPatente(h.DB.QueryRow(r.Context(),
		`SELECT `+patenteCols+` FROM patente_declarations WHERE id=$1 AND company_id=$2`, id, companyID,
	), &d); err != nil {
		jsonError(w, "Déclaration Patente introuvable", http.StatusNotFound)
		return
	}

	ref := ""
	if d.Ref != nil {
		ref = *d.Ref
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="Patente-%d.csv"`, d.Annee))
	cw := csv.NewWriter(w)
	cw.Write([]string{"Référence", "Année", "CA", "Valeur locative", "Droit fixe", "Droit proportionnel (1%)", "Total patente", "Statut"})
	cw.Write([]string{
		ref,
		strconv.Itoa(d.Annee),
		strconv.FormatFloat(d.CA, 'f', 0, 64),
		strconv.FormatFloat(d.ValeurLocative, 'f', 0, 64),
		strconv.FormatFloat(d.DroitFixe, 'f', 0, 64),
		strconv.FormatFloat(d.DroitProp, 'f', 0, 64),
		strconv.FormatFloat(d.TotalPatente, 'f', 0, 64),
		d.Statut,
	})
	cw.Flush()
}
