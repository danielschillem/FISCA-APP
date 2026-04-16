package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CompaniesHandler gère le CRUD multi-sociétés.
type CompaniesHandler struct {
	DB *pgxpool.Pool
}

func NewCompaniesHandler(db *pgxpool.Pool) *CompaniesHandler {
	return &CompaniesHandler{DB: db}
}

// GET /api/companies — liste toutes les sociétés de l'utilisateur
func (h *CompaniesHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	rows, err := h.DB.Query(r.Context(),
		`SELECT id, user_id, nom, COALESCE(ifu,''), COALESCE(rc,''),
		        COALESCE(secteur,''), COALESCE(adresse,''), COALESCE(tel,'')
		 FROM companies WHERE user_id=$1 ORDER BY nom`, userID)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []models.Company{}
	for rows.Next() {
		var c models.Company
		if err := rows.Scan(&c.ID, &c.UserID, &c.Nom, &c.IFU, &c.RC, &c.Secteur, &c.Adresse, &c.Tel); err != nil {
			continue
		}
		items = append(items, c)
	}
	jsonOK(w, items)
}

// POST /api/companies — créer une nouvelle société
func (h *CompaniesHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req models.Company
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Nom == "" {
		jsonError(w, "nom requis", http.StatusBadRequest)
		return
	}

	// Vérifier la limite de sociétés selon le plan
	var plan string
	var orgID *string
	h.DB.QueryRow(r.Context(), `SELECT plan, org_id FROM users WHERE id=$1`, userID).Scan(&plan, &orgID) //nolint:errcheck

	var maxCompanies int
	if orgID != nil {
		h.DB.QueryRow(r.Context(), `SELECT max_companies FROM organizations WHERE id=$1`, *orgID).Scan(&maxCompanies) //nolint:errcheck
	} else {
		switch plan {
		case "physique_starter", "physique_pro", "starter", "pro":
			maxCompanies = 1
		case "moral_team":
			maxCompanies = 2
		default:
			maxCompanies = 0 // illimité
		}
	}
	if maxCompanies > 0 {
		var currentCount int
		if orgID != nil {
			h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM companies WHERE org_id=$1`, *orgID).Scan(&currentCount) //nolint:errcheck
		} else {
			h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM companies WHERE user_id=$1`, userID).Scan(&currentCount) //nolint:errcheck
		}
		if currentCount >= maxCompanies {
			jsonError(w, fmt.Sprintf("Limite atteinte : votre plan autorise %d société(s) maximum. Passez à un plan supérieur.", maxCompanies), http.StatusPaymentRequired)
			return
		}
	}

	var c models.Company
	err := h.DB.QueryRow(r.Context(),
		`INSERT INTO companies (user_id, nom, ifu, rc, secteur, adresse, tel)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING id, user_id, nom, COALESCE(ifu,''), COALESCE(rc,''),
		   COALESCE(secteur,''), COALESCE(adresse,''), COALESCE(tel,'')`,
		userID, req.Nom, req.IFU, req.RC, req.Secteur, req.Adresse, req.Tel,
	).Scan(&c.ID, &c.UserID, &c.Nom, &c.IFU, &c.RC, &c.Secteur, &c.Adresse, &c.Tel)
	if err != nil {
		jsonError(w, "Erreur création société", http.StatusInternalServerError)
		return
	}
	jsonCreated(w, c)
}

// PUT /api/companies/{id}
func (h *CompaniesHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := chi.URLParam(r, "id")

	var req models.Company
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}

	var c models.Company
	err := h.DB.QueryRow(r.Context(),
		`UPDATE companies SET nom=$1, ifu=$2, rc=$3, secteur=$4, adresse=$5, tel=$6
		 WHERE id=$7 AND user_id=$8
		 RETURNING id, user_id, nom, COALESCE(ifu,''), COALESCE(rc,''),
		   COALESCE(secteur,''), COALESCE(adresse,''), COALESCE(tel,'')`,
		req.Nom, req.IFU, req.RC, req.Secteur, req.Adresse, req.Tel, id, userID,
	).Scan(&c.ID, &c.UserID, &c.Nom, &c.IFU, &c.RC, &c.Secteur, &c.Adresse, &c.Tel)
	if err != nil {
		jsonError(w, "Société introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, c)
}

// DELETE /api/companies/{id} — refuse de supprimer la dernière société
func (h *CompaniesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := chi.URLParam(r, "id")

	// Vérifier qu'il reste au moins 2 sociétés avant suppression
	var count int
	_ = h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM companies WHERE user_id=$1`, userID).Scan(&count)
	if count <= 1 {
		jsonError(w, "Impossible de supprimer la dernière société", http.StatusConflict)
		return
	}

	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM companies WHERE id=$1 AND user_id=$2`, id, userID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Société introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
