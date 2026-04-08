package handlers

import (
	"encoding/json"
	"net/http"

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

// GET /api/employees
func (h *EmployeeHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.getCompanyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	rows, err := h.DB.Query(r.Context(),
		`SELECT id, company_id, nom, categorie, charges,
		        salaire_base, anciennete, heures_sup, logement, transport, fonction
		 FROM employees WHERE company_id=$1 ORDER BY nom`,
		companyID,
	)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	employees := []models.Employee{}
	for rows.Next() {
		var e models.Employee
		if err := rows.Scan(&e.ID, &e.CompanyID, &e.Nom, &e.Categorie, &e.Charges,
			&e.SalaireBase, &e.Anciennete, &e.HeuresSup, &e.Logement, &e.Transport, &e.Fonction,
		); err != nil {
			continue
		}
		employees = append(employees, e)
	}
	jsonOK(w, employees)
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

	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO employees (company_id, nom, categorie, charges,
		  salaire_base, anciennete, heures_sup, logement, transport, fonction)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 RETURNING id`,
		companyID, e.Nom, e.Categorie, e.Charges,
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

	tag, err := h.DB.Exec(r.Context(),
		`UPDATE employees SET nom=$1, categorie=$2, charges=$3,
		  salaire_base=$4, anciennete=$5, heures_sup=$6,
		  logement=$7, transport=$8, fonction=$9
		 WHERE id=$10 AND company_id=$11`,
		e.Nom, e.Categorie, e.Charges,
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
