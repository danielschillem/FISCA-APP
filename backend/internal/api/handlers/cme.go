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

type CMEHandler struct {
	DB *pgxpool.Pool
}

func NewCMEHandler(db *pgxpool.Pool) *CMEHandler { return &CMEHandler{DB: db} }

func (h *CMEHandler) companyID(r *http.Request) (string, error) {
	id := middleware.GetCompanyID(r)
	if id == "" {
		return "", fmt.Errorf("company not found")
	}
	return id, nil
}

func (h *CMEHandler) checkPlan(r *http.Request, allowed ...string) bool {
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

const cmeCols = `id, company_id, annee, ca, zone, adhesion_cga, classe,
	cme, cme_net, statut, ref, created_at`

func scanCME(row interface{ Scan(...any) error }, d *models.CMEDeclaration) error {
	return row.Scan(
		&d.ID, &d.CompanyID, &d.Annee, &d.CA, &d.Zone, &d.AdhesionCGA, &d.Classe,
		&d.CME, &d.CMENet, &d.Statut, &d.Ref, &d.CreatedAt,
	)
}

// GET /api/cme
func (h *CMEHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	q := r.URL.Query()
	annee := q.Get("annee")

	query := `SELECT ` + cmeCols + ` FROM cme_declarations WHERE company_id=$1`
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

	items := []models.CMEDeclaration{}
	for rows.Next() {
		var d models.CMEDeclaration
		if scanCME(rows, &d) == nil {
			items = append(items, d)
		}
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(len(items)))
	jsonOK(w, items)
}

// POST /api/cme [Plan: Enterprise]
func (h *CMEHandler) Create(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	if !h.checkPlan(r, "moral_team", "enterprise", "moral_enterprise") {
		jsonError(w, "Le module CME nécessite le plan Équipe ou Enterprise.", http.StatusPaymentRequired)
		return
	}

	var req struct {
		Annee       int     `json:"annee"`
		CA          float64 `json:"ca"`
		Zone        string  `json:"zone"`
		AdhesionCGA bool    `json:"adhesion_cga"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Annee < 2000 || req.CA <= 0 {
		jsonError(w, "annee (≥ 2000) et ca (> 0) requis", http.StatusBadRequest)
		return
	}

	res := calc.CalcCME(req.CA, req.Zone, req.AdhesionCGA)
	ref := fmt.Sprintf("CME-%d-%04d", req.Annee, time.Now().UnixNano()%10000)

	var d models.CMEDeclaration
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO cme_declarations
		 (company_id, annee, ca, zone, adhesion_cga, classe, cme, cme_net, statut, ref)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'brouillon',$9)
		 RETURNING `+cmeCols,
		companyID, req.Annee, res.CA, res.Zone, req.AdhesionCGA, res.Classe,
		res.CME, res.CMENet, ref,
	).Scan(
		&d.ID, &d.CompanyID, &d.Annee, &d.CA, &d.Zone, &d.AdhesionCGA, &d.Classe,
		&d.CME, &d.CMENet, &d.Statut, &d.Ref, &d.CreatedAt,
	)
	if err != nil {
		jsonError(w, "Erreur création déclaration CME", http.StatusInternalServerError)
		return
	}
	jsonCreated(w, d)
}

// GET /api/cme/{id}
func (h *CMEHandler) Get(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	var d models.CMEDeclaration
	if err := scanCME(h.DB.QueryRow(r.Context(),
		`SELECT `+cmeCols+` FROM cme_declarations WHERE id=$1 AND company_id=$2`, id, companyID,
	), &d); err != nil {
		jsonError(w, "Déclaration CME introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, d)
}

// PATCH /api/cme/{id}/valider
func (h *CMEHandler) Valider(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.DB.Exec(r.Context(),
		`UPDATE cme_declarations SET statut='declare' WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Déclaration CME introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, map[string]string{"statut": "declare"})
}

// DELETE /api/cme/{id}
func (h *CMEHandler) Delete(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM cme_declarations WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Déclaration CME introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/cme/{id}/export
func (h *CMEHandler) Export(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	var d models.CMEDeclaration
	if err := scanCME(h.DB.QueryRow(r.Context(),
		`SELECT `+cmeCols+` FROM cme_declarations WHERE id=$1 AND company_id=$2`, id, companyID,
	), &d); err != nil {
		jsonError(w, "Déclaration CME introuvable", http.StatusNotFound)
		return
	}

	ref := ""
	if d.Ref != nil {
		ref = *d.Ref
	}
	cga := "Non"
	if d.AdhesionCGA {
		cga = "Oui"
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="CME-%d.csv"`, d.Annee))
	cw := csv.NewWriter(w)
	cw.Write([]string{"Référence", "Année", "CA", "Zone", "CGA", "Classe", "CME brute", "CME nette", "Statut"})
	cw.Write([]string{
		ref,
		strconv.Itoa(d.Annee),
		strconv.FormatFloat(d.CA, 'f', 0, 64),
		d.Zone, cga,
		strconv.Itoa(d.Classe),
		strconv.FormatFloat(d.CME, 'f', 0, 64),
		strconv.FormatFloat(d.CMENet, 'f', 0, 64),
		d.Statut,
	})
	cw.Flush()
}
