package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CompanyHandler struct {
	DB *pgxpool.Pool
}

func NewCompanyHandler(db *pgxpool.Pool) *CompanyHandler {
	return &CompanyHandler{DB: db}
}

// GET /api/company
func (h *CompanyHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var c models.Company
	err := h.DB.QueryRow(r.Context(),
		`SELECT id, user_id, nom, COALESCE(ifu,''), COALESCE(rc,''),
		        COALESCE(secteur,''), COALESCE(adresse,''), COALESCE(tel,'')
		 FROM companies WHERE user_id=$1 LIMIT 1`, userID,
	).Scan(&c.ID, &c.UserID, &c.Nom, &c.IFU, &c.RC, &c.Secteur, &c.Adresse, &c.Tel)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, c)
}

// PUT /api/company
func (h *CompanyHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var c models.Company
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}

	tag, err := h.DB.Exec(r.Context(),
		`UPDATE companies SET nom=$1, ifu=$2, rc=$3, secteur=$4, adresse=$5, tel=$6
		 WHERE user_id=$7`,
		c.Nom, c.IFU, c.RC, c.Secteur, c.Adresse, c.Tel, userID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Erreur mise à jour", http.StatusInternalServerError)
		return
	}
	jsonOK(w, c)
}
