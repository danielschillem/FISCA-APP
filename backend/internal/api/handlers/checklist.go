package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ChecklistHandler struct {
	DB *pgxpool.Pool
}

func NewChecklistHandler(db *pgxpool.Pool) *ChecklistHandler {
	return &ChecklistHandler{DB: db}
}

// GET /api/checklist - retourne { "item_id": true/false, ... } pour l'utilisateur courant
func (h *ChecklistHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := h.DB.Query(r.Context(),
		`SELECT item_id, checked FROM checklist_state WHERE user_id=$1`, userID)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	result := map[string]bool{}
	for rows.Next() {
		var itemID string
		var checked bool
		if rows.Scan(&itemID, &checked) == nil {
			result[itemID] = checked
		}
	}
	jsonOK(w, result)
}

// PUT /api/checklist/{id} - coche/décoche un item
func (h *ChecklistHandler) Toggle(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	itemID := chi.URLParam(r, "id")
	if itemID == "" {
		jsonError(w, "item_id requis", http.StatusBadRequest)
		return
	}

	var req struct {
		Checked bool `json:"checked"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Corps invalide", http.StatusBadRequest)
		return
	}

	_, err := h.DB.Exec(r.Context(),
		`INSERT INTO checklist_state (user_id, item_id, checked, updated_at)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (user_id, item_id) DO UPDATE SET checked=EXCLUDED.checked, updated_at=NOW()`,
		userID, itemID, req.Checked)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"item_id": itemID, "checked": req.Checked})
}
