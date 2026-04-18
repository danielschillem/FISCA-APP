package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/calc"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SimulationHandler struct {
	DB *pgxpool.Pool
}

func NewSimulationHandler(db *pgxpool.Pool) *SimulationHandler {
	return &SimulationHandler{DB: db}
}

func (h *SimulationHandler) companyID(r *http.Request) (string, error) {
	id := middleware.GetCompanyID(r)
	if id == "" {
		return "", fmt.Errorf("company not found")
	}
	return id, nil
}

// checkPlan retourne true si le plan de l'utilisateur est l'un des plans autorisés.
func (h *SimulationHandler) checkPlan(r *http.Request, allowed ...string) bool {
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

// GET /api/simulations
func (h *SimulationHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	rows, err := h.DB.Query(r.Context(),
		`SELECT id, company_id, label, cotisation, input_data, result_data, created_at
		 FROM simulations WHERE company_id=$1 ORDER BY created_at DESC`, companyID)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []models.Simulation{}
	for rows.Next() {
		var s models.Simulation
		if err := rows.Scan(&s.ID, &s.CompanyID, &s.Label, &s.Cotisation,
			&s.InputData, &s.ResultData, &s.CreatedAt); err != nil {
			continue
		}
		items = append(items, s)
	}
	jsonOK(w, items)
}

// POST /api/simulations - calcul + sauvegarde [Plan: Pro+]
func (h *SimulationHandler) Create(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	if !h.checkPlan(r, "pro", "physique_pro", "enterprise", "moral_team", "moral_enterprise") {
		jsonError(w, "Le simulateur fiscal nécessite le plan Pro ou Enterprise.", http.StatusPaymentRequired)
		return
	}

	var req struct {
		Label string               `json:"label"`
		Input models.CalculRequest `json:"input"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if req.Input.Cotisation == "" {
		req.Input.Cotisation = "CNSS"
	}

	result := calc.CalcSalarie(calc.SalarieInput{
		SalaireBase: req.Input.SalaireBase,
		Anciennete:  req.Input.Anciennete,
		HeuresSup:   req.Input.HeuresSup,
		Logement:    req.Input.Logement,
		Transport:   req.Input.Transport,
		Fonction:    req.Input.Fonction,
		Charges:     req.Input.Charges,
		Cotisation:  req.Input.Cotisation,
	})

	inputJSON, _ := json.Marshal(req.Input)
	resultJSON, _ := json.Marshal(result)

	var s models.Simulation
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO simulations (company_id, label, cotisation, input_data, result_data)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, company_id, label, cotisation, input_data, result_data, created_at`,
		companyID, req.Label, req.Input.Cotisation, inputJSON, resultJSON,
	).Scan(&s.ID, &s.CompanyID, &s.Label, &s.Cotisation,
		&s.InputData, &s.ResultData, &s.CreatedAt)
	if err != nil {
		jsonError(w, "Erreur création simulation", http.StatusInternalServerError)
		return
	}
	jsonCreated(w, s)
}

// GET /api/simulations/{id}
func (h *SimulationHandler) Get(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	var s models.Simulation
	err = h.DB.QueryRow(r.Context(),
		`SELECT id, company_id, label, cotisation, input_data, result_data, created_at
		 FROM simulations WHERE id=$1 AND company_id=$2`, id, companyID,
	).Scan(&s.ID, &s.CompanyID, &s.Label, &s.Cotisation,
		&s.InputData, &s.ResultData, &s.CreatedAt)
	if err != nil {
		jsonError(w, "Simulation introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, s)
}

// DELETE /api/simulations/{id}
func (h *SimulationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM simulations WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Simulation introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
