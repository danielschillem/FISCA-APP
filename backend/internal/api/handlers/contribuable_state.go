package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ContribuableStateHandler struct {
	DB *pgxpool.Pool
}

func NewContribuableStateHandler(db *pgxpool.Pool) *ContribuableStateHandler {
	return &ContribuableStateHandler{DB: db}
}

type upsertContribuableStateRequest struct {
	State json.RawMessage `json:"state"`
}

// GET /api/contribuable/state
func (h *ContribuableStateHandler) Get(w http.ResponseWriter, r *http.Request) {
	companyID := middleware.GetCompanyID(r)
	if companyID == "" {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var raw json.RawMessage
	err := h.DB.QueryRow(r.Context(),
		`SELECT state FROM contribuable_states WHERE company_id=$1`,
		companyID,
	).Scan(&raw)
	if err != nil {
		jsonOK(w, map[string]any{"state": nil})
		return
	}
	jsonOK(w, map[string]any{"state": raw})
}

// PUT /api/contribuable/state
func (h *ContribuableStateHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	companyID := middleware.GetCompanyID(r)
	if companyID == "" {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var req upsertContribuableStateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if len(req.State) == 0 || string(req.State) == "null" {
		jsonError(w, "state requis", http.StatusBadRequest)
		return
	}

	if !json.Valid(req.State) {
		jsonError(w, "state JSON invalide", http.StatusBadRequest)
		return
	}

	_, err := h.DB.Exec(r.Context(),
		`INSERT INTO contribuable_states (company_id, state, updated_at)
		 VALUES ($1, $2::jsonb, NOW())
		 ON CONFLICT (company_id)
		 DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
		companyID, req.State,
	)
	if err != nil {
		jsonError(w, "Erreur de sauvegarde", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"ok": true})
}
