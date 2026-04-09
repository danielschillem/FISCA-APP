package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type EmployeeHandler struct {
	DB *pgxpool.Pool
}

func NewEmployeeHandler(db *pgxpool.Pool) *EmployeeHandler {
	return &EmployeeHandler{DB: db}
}

// getCompanyID retourne l'ID de l'entreprise de l'utilisateur connecté.
func (h *EmployeeHandler) getCompanyID(r *http.Request) (string, error) {
	userID := middleware.GetUserID(r)
	var companyID string
	err := h.DB.QueryRow(r.Context(),
		`SELECT id FROM companies WHERE user_id=$1 LIMIT 1`,
		userID,
	).Scan(&companyID)
	return companyID, err
}

// GET /api/employees?page=1&limit=100
func (h *EmployeeHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.getCompanyID(r)
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

	rows, err := h.DB.Query(r.Context(),
		`SELECT id, company_id, nom, categorie, cotisation, charges,
		        salaire_base, anciennete, heures_sup, logement, transport, fonction
		 FROM employees WHERE company_id=$1 ORDER BY nom LIMIT $2 OFFSET $3`,
		companyID, limit, offset,
	)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	employees := []models.Employee{}
	for rows.Next() {
		var e models.Employee
		if err := rows.Scan(&e.ID, &e.CompanyID, &e.Nom, &e.Categorie, &e.Cotisation, &e.Charges,
			&e.SalaireBase, &e.Anciennete, &e.HeuresSup, &e.Logement, &e.Transport, &e.Fonction,
		); err != nil {
			continue
		}
		employees = append(employees, e)
	}
	jsonOK(w, employees)
}

// validateEmployee vérifie les champs fondamentaux d'un employé.
func validateEmployee(e *models.Employee) string {
	if len(strings.TrimSpace(e.Nom)) == 0 {
		return "Le nom de l'employé est requis"
	}
	if len(e.Nom) > 100 {
		return "Nom trop long (max 100 caractères)"
	}
	if e.Categorie != "Cadre" && e.Categorie != "Non-cadre" {
		e.Categorie = "Non-cadre"
	}
	if e.Cotisation != "CARFO" {
		e.Cotisation = "CNSS"
	}
	if e.Charges < 0 || e.Charges > 6 {
		return "Charges familiales : valeur entre 0 et 6"
	}
	if e.SalaireBase < 0 || e.Anciennete < 0 || e.HeuresSup < 0 ||
		e.Logement < 0 || e.Transport < 0 || e.Fonction < 0 {
		return "Les montants ne peuvent pas être négatifs"
	}
	const maxSalary = 100_000_000 // 100M FCFA
	if e.SalaireBase > maxSalary || e.Anciennete > maxSalary {
		return "Montant invalide"
	}
	return ""
}

// POST /api/employees
func (h *EmployeeHandler) Create(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.getCompanyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var e models.Employee
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if msg := validateEmployee(&e); msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}

	// Gating plan : starter ≤ 10 employés
	userID := middleware.GetUserID(r)
	var plan string
	h.DB.QueryRow(r.Context(), `SELECT plan FROM users WHERE id=$1`, userID).Scan(&plan)
	if plan == "starter" {
		var count int
		h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM employees WHERE company_id=$1`, companyID).Scan(&count)
		if count >= 10 {
			jsonError(w, "Limite atteinte : le plan Starter est limité à 10 employés. Passez au plan Pro pour continuer.", http.StatusPaymentRequired)
			return
		}
	}
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO employees (company_id, nom, categorie, cotisation, charges,
		  salaire_base, anciennete, heures_sup, logement, transport, fonction)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		 RETURNING id`,
		companyID, e.Nom, e.Categorie, e.Cotisation, e.Charges,
		e.SalaireBase, e.Anciennete, e.HeuresSup, e.Logement, e.Transport, e.Fonction,
	).Scan(&e.ID)
	if err != nil {
		jsonError(w, "Erreur création", http.StatusInternalServerError)
		return
	}
	e.CompanyID = companyID
	jsonCreated(w, e)
}

// PUT /api/employees/{id}
func (h *EmployeeHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.getCompanyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var e models.Employee
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if msg := validateEmployee(&e); msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}

	if e.Cotisation != "CARFO" {
		e.Cotisation = "CNSS"
	}
	tag, err := h.DB.Exec(r.Context(),
		`UPDATE employees SET nom=$1, categorie=$2, cotisation=$3, charges=$4,
		  salaire_base=$5, anciennete=$6, heures_sup=$7,
		  logement=$8, transport=$9, fonction=$10
		 WHERE id=$11 AND company_id=$12`,
		e.Nom, e.Categorie, e.Cotisation, e.Charges,
		e.SalaireBase, e.Anciennete, e.HeuresSup,
		e.Logement, e.Transport, e.Fonction,
		id, companyID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Employé introuvable", http.StatusNotFound)
		return
	}
	e.ID = id
	jsonOK(w, e)
}

// DELETE /api/employees/{id}
func (h *EmployeeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.getCompanyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM employees WHERE id=$1 AND company_id=$2`,
		id, companyID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Employé introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
