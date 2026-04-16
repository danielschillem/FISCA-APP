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

type IRFHandler struct {
	DB *pgxpool.Pool
}

func NewIRFHandler(db *pgxpool.Pool) *IRFHandler { return &IRFHandler{DB: db} }

func (h *IRFHandler) companyID(r *http.Request) (string, error) {
	id := middleware.GetCompanyID(r)
	if id == "" {
		return "", fmt.Errorf("company not found")
	}
	return id, nil
}

func (h *IRFHandler) checkPlan(r *http.Request, allowed ...string) bool {
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

const irfCols = `id, company_id, annee, loyer_brut, abattement, base_nette,
	irf1, irf2, irf_total, loyer_net, statut, ref, created_at`

func scanIRF(row interface{ Scan(...any) error }, d *models.IRFDeclaration) error {
	return row.Scan(
		&d.ID, &d.CompanyID, &d.Annee, &d.LoyerBrut, &d.Abattement, &d.BaseNette,
		&d.IRF1, &d.IRF2, &d.IRFTotal, &d.LoyerNet, &d.Statut, &d.Ref, &d.CreatedAt,
	)
}

// GET /api/irf
func (h *IRFHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	q := r.URL.Query()
	annee := q.Get("annee")

	query := `SELECT ` + irfCols + ` FROM irf_declarations WHERE company_id=$1`
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

	items := []models.IRFDeclaration{}
	for rows.Next() {
		var d models.IRFDeclaration
		if scanIRF(rows, &d) == nil {
			items = append(items, d)
		}
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(len(items)))
	jsonOK(w, items)
}

// POST /api/irf [Plan: Pro+]
func (h *IRFHandler) Create(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	if !h.checkPlan(r, "pro", "enterprise") {
		jsonError(w, "Le module IRF nécessite le plan Pro ou Enterprise.", http.StatusPaymentRequired)
		return
	}

	var req struct {
		Annee     int     `json:"annee"`
		LoyerBrut float64 `json:"loyer_brut"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Annee < 2000 || req.LoyerBrut <= 0 {
		jsonError(w, "annee (≥ 2000) et loyer_brut (> 0) requis", http.StatusBadRequest)
		return
	}

	res := calc.CalcIRF(req.LoyerBrut)
	ref := fmt.Sprintf("IRF-%d-%04d", req.Annee, time.Now().UnixNano()%10000)

	var d models.IRFDeclaration
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO irf_declarations
		 (company_id, annee, loyer_brut, abattement, base_nette, irf1, irf2, irf_total, loyer_net, statut, ref)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'brouillon',$10)
		 RETURNING `+irfCols,
		companyID, req.Annee, res.LoyerBrut, res.Abattement, res.BaseNette,
		res.IRF1, res.IRF2, res.IRFTotal, res.LoyerNet, ref,
	).Scan(
		&d.ID, &d.CompanyID, &d.Annee, &d.LoyerBrut, &d.Abattement, &d.BaseNette,
		&d.IRF1, &d.IRF2, &d.IRFTotal, &d.LoyerNet, &d.Statut, &d.Ref, &d.CreatedAt,
	)
	if err != nil {
		jsonError(w, "Erreur création déclaration IRF", http.StatusInternalServerError)
		return
	}
	jsonCreated(w, d)
}

// GET /api/irf/{id}
func (h *IRFHandler) Get(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	var d models.IRFDeclaration
	if err := scanIRF(h.DB.QueryRow(r.Context(),
		`SELECT `+irfCols+` FROM irf_declarations WHERE id=$1 AND company_id=$2`, id, companyID,
	), &d); err != nil {
		jsonError(w, "Déclaration IRF introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, d)
}

// PATCH /api/irf/{id}/valider
func (h *IRFHandler) Valider(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.DB.Exec(r.Context(),
		`UPDATE irf_declarations SET statut='declare' WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Déclaration IRF introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, map[string]string{"statut": "declare"})
}

// DELETE /api/irf/{id}
func (h *IRFHandler) Delete(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM irf_declarations WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Déclaration IRF introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/irf/{id}/export
func (h *IRFHandler) Export(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	var d models.IRFDeclaration
	if err := scanIRF(h.DB.QueryRow(r.Context(),
		`SELECT `+irfCols+` FROM irf_declarations WHERE id=$1 AND company_id=$2`, id, companyID,
	), &d); err != nil {
		jsonError(w, "Déclaration IRF introuvable", http.StatusNotFound)
		return
	}

	ref := ""
	if d.Ref != nil {
		ref = *d.Ref
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="IRF-%d.csv"`, d.Annee))
	cw := csv.NewWriter(w)
	cw.Write([]string{"Référence", "Année", "Loyer brut", "Abattement 50%", "Base nette", "IRF 18%", "IRF 25%", "IRF total", "Loyer net", "Statut"})
	cw.Write([]string{
		ref,
		strconv.Itoa(d.Annee),
		strconv.FormatFloat(d.LoyerBrut, 'f', 0, 64),
		strconv.FormatFloat(d.Abattement, 'f', 0, 64),
		strconv.FormatFloat(d.BaseNette, 'f', 0, 64),
		strconv.FormatFloat(d.IRF1, 'f', 0, 64),
		strconv.FormatFloat(d.IRF2, 'f', 0, 64),
		strconv.FormatFloat(d.IRFTotal, 'f', 0, 64),
		strconv.FormatFloat(d.LoyerNet, 'f', 0, 64),
		d.Statut,
	})
	cw.Flush()
}
