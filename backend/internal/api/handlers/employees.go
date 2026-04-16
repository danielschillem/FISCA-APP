package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
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

	// Total pour pagination coté client
	var total int
	h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM employees WHERE company_id=$1`, companyID).Scan(&total)

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
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	w.Header().Set("X-Page", strconv.Itoa(page))
	w.Header().Set("X-Limit", strconv.Itoa(limit))
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

	// Gating plan : vérification de la limite d'employés selon le plan
	userID := middleware.GetUserID(r)
	var plan string
	var orgID *string
	h.DB.QueryRow(r.Context(), `SELECT plan, org_id FROM users WHERE id=$1`, userID).Scan(&plan, &orgID) //nolint:errcheck

	var maxEmp int
	if orgID != nil {
		// Personne morale : limite définie dans organizations
		h.DB.QueryRow(r.Context(), `SELECT max_employees FROM organizations WHERE id=$1`, *orgID).Scan(&maxEmp) //nolint:errcheck
	} else {
		// Personne physique : limite par plan
		switch plan {
		case "physique_starter", "starter":
			maxEmp = 3
		case "physique_pro", "pro":
			maxEmp = 10
		default:
			maxEmp = 0 // 0 = illimité
		}
	}
	if maxEmp > 0 {
		var currentCount int
		// Pour morale : compter tous les employés de l'org
		if orgID != nil {
			h.DB.QueryRow(r.Context(),
				`SELECT COUNT(*) FROM employees e JOIN companies c ON e.company_id=c.id WHERE c.org_id=$1`, *orgID,
			).Scan(&currentCount) //nolint:errcheck
		} else {
			h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM employees WHERE company_id=$1`, companyID).Scan(&currentCount) //nolint:errcheck
		}
		if currentCount >= maxEmp {
			jsonError(w, fmt.Sprintf("Limite atteinte : votre plan autorise %d employés maximum. Passez à un plan supérieur.", maxEmp), http.StatusPaymentRequired)
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

// GET /api/employees/export — Export CSV de tous les employés
func (h *EmployeeHandler) Export(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.getCompanyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	rows, err := h.DB.Query(r.Context(),
		`SELECT nom, categorie, cotisation, charges,
		        salaire_base, anciennete, heures_sup, logement, transport, fonction
		 FROM employees WHERE company_id=$1 ORDER BY nom`,
		companyID,
	)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="employes-fisca.csv"`)
	w.Write([]byte("\xEF\xBB\xBF")) // BOM UTF-8

	cw := csv.NewWriter(w)
	cw.Comma = ';'
	_ = cw.Write([]string{
		"NOM", "CATEGORIE", "COTISATION", "CHARGES_FAMILIALES",
		"SALAIRE_BASE", "ANCIENNETE", "HEURES_SUP", "LOGEMENT", "TRANSPORT", "FONCTION",
	})

	for rows.Next() {
		var e models.Employee
		if err := rows.Scan(&e.Nom, &e.Categorie, &e.Cotisation, &e.Charges,
			&e.SalaireBase, &e.Anciennete, &e.HeuresSup, &e.Logement, &e.Transport, &e.Fonction,
		); err != nil {
			continue
		}
		_ = cw.Write([]string{
			e.Nom, e.Categorie, e.Cotisation, strconv.Itoa(e.Charges),
			fmt.Sprintf("%.0f", e.SalaireBase), fmt.Sprintf("%.0f", e.Anciennete),
			fmt.Sprintf("%.0f", e.HeuresSup), fmt.Sprintf("%.0f", e.Logement),
			fmt.Sprintf("%.0f", e.Transport), fmt.Sprintf("%.0f", e.Fonction),
		})
	}
	cw.Flush()
}

// POST /api/employees/import — Import CSV d'employés (remplace ou complète)
// Format attendu (séparateur ; ou ,) :
// NOM;CATEGORIE;COTISATION;CHARGES_FAMILIALES;SALAIRE_BASE;ANCIENNETE;HEURES_SUP;LOGEMENT;TRANSPORT;FONCTION
func (h *EmployeeHandler) Import(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.getCompanyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	// Limit body to 2 MB
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)

	// Vérifier le plan
	userID := middleware.GetUserID(r)
	var plan string
	h.DB.QueryRow(r.Context(), `SELECT plan FROM users WHERE id=$1`, userID).Scan(&plan)

	cr := csv.NewReader(r.Body)
	cr.Comma = ';'
	cr.LazyQuotes = true
	cr.TrimLeadingSpace = true

	records, err := cr.ReadAll()
	if err != nil {
		// Retry with comma separator
		return
	}
	if len(records) < 2 {
		jsonError(w, "Fichier CSV vide ou sans données (entête + au moins 1 ligne requises)", http.StatusBadRequest)
		return
	}

	// Normalise column headers (lowercase, trim)
	headers := make([]string, len(records[0]))
	for i, h := range records[0] {
		headers[i] = strings.ToLower(strings.TrimSpace(h))
	}
	colIdx := func(names ...string) int {
		for _, name := range names {
			for i, h := range headers {
				if h == name {
					return i
				}
			}
		}
		return -1
	}

	idxNom := colIdx("nom", "name", "prenom_nom")
	idxCat := colIdx("categorie", "category")
	idxCot := colIdx("cotisation")
	idxChg := colIdx("charges_familiales", "charges")
	idxSal := colIdx("salaire_base", "salaire")
	idxAnc := colIdx("anciennete")
	idxHSup := colIdx("heures_sup", "heures_supplementaires")
	idxLog := colIdx("logement")
	idxTrans := colIdx("transport")
	idxFonct := colIdx("fonction")

	if idxNom < 0 || idxSal < 0 {
		jsonError(w, "Colonnes obligatoires manquantes : NOM et SALAIRE_BASE sont requis", http.StatusBadRequest)
		return
	}

	parse := func(row []string, idx int) float64 {
		if idx < 0 || idx >= len(row) {
			return 0
		}
		v := strings.ReplaceAll(strings.TrimSpace(row[idx]), " ", "")
		f, _ := strconv.ParseFloat(v, 64)
		return f
	}
	parseInt := func(row []string, idx int) int {
		v := parse(row, idx)
		return int(v)
	}
	strVal := func(row []string, idx int) string {
		if idx < 0 || idx >= len(row) {
			return ""
		}
		return strings.TrimSpace(row[idx])
	}

	// Limite plan starter
	if plan == "starter" {
		var current int
		h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM employees WHERE company_id=$1`, companyID).Scan(&current)
		remaining := 10 - current
		if remaining <= 0 {
			jsonError(w, "Limite atteinte : plan Starter limité à 10 employés", http.StatusPaymentRequired)
			return
		}
		if len(records)-1 > remaining {
			jsonError(w, fmt.Sprintf("Import limité à %d employés pour le plan Starter (vous en avez déjà %d)", 10, current), http.StatusPaymentRequired)
			return
		}
	}

	imported, errors := 0, []string{}
	for i, row := range records[1:] {
		if len(row) == 0 || strings.TrimSpace(strings.Join(row, "")) == "" {
			continue
		}
		e := models.Employee{
			CompanyID:   companyID,
			Nom:         strVal(row, idxNom),
			Categorie:   strVal(row, idxCat),
			Cotisation:  strVal(row, idxCot),
			Charges:     parseInt(row, idxChg),
			SalaireBase: parse(row, idxSal),
			Anciennete:  parse(row, idxAnc),
			HeuresSup:   parse(row, idxHSup),
			Logement:    parse(row, idxLog),
			Transport:   parse(row, idxTrans),
			Fonction:    parse(row, idxFonct),
		}
		if msg := validateEmployee(&e); msg != "" {
			errors = append(errors, fmt.Sprintf("Ligne %d (%s) : %s", i+2, e.Nom, msg))
			continue
		}
		_, err := h.DB.Exec(r.Context(),
			`INSERT INTO employees (company_id, nom, categorie, cotisation, charges,
			  salaire_base, anciennete, heures_sup, logement, transport, fonction)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
			 ON CONFLICT DO NOTHING`,
			companyID, e.Nom, e.Categorie, e.Cotisation, e.Charges,
			e.SalaireBase, e.Anciennete, e.HeuresSup, e.Logement, e.Transport, e.Fonction,
		)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Ligne %d (%s) : erreur base de données", i+2, e.Nom))
		} else {
			imported++
		}
	}

	jsonOK(w, map[string]any{
		"imported": imported,
		"errors":   errors,
		"total":    len(records) - 1,
	})
}
