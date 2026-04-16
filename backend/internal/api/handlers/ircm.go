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

type IRCMHandler struct {
	DB *pgxpool.Pool
}

func NewIRCMHandler(db *pgxpool.Pool) *IRCMHandler { return &IRCMHandler{DB: db} }

func (h *IRCMHandler) companyID(r *http.Request) (string, error) {
	id := middleware.GetCompanyID(r)
	if id == "" {
		return "", fmt.Errorf("company not found")
	}
	return id, nil
}

func (h *IRCMHandler) checkPlan(r *http.Request, allowed ...string) bool {
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

const ircmCols = `id, company_id, annee, montant_brut, type_revenu, taux,
	ircm_total, montant_net, statut, ref, created_at`

func scanIRCM(row interface{ Scan(...any) error }, d *models.IRCMDeclaration) error {
	return row.Scan(
		&d.ID, &d.CompanyID, &d.Annee, &d.MontantBrut, &d.TypeRevenu, &d.Taux,
		&d.IRCMTotal, &d.MontantNet, &d.Statut, &d.Ref, &d.CreatedAt,
	)
}

// GET /api/ircm
func (h *IRCMHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	q := r.URL.Query()
	annee := q.Get("annee")

	query := `SELECT ` + ircmCols + ` FROM ircm_declarations WHERE company_id=$1`
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

	items := []models.IRCMDeclaration{}
	for rows.Next() {
		var d models.IRCMDeclaration
		if scanIRCM(rows, &d) == nil {
			items = append(items, d)
		}
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(len(items)))
	jsonOK(w, items)
}

// POST /api/ircm [Plan: Pro+]
func (h *IRCMHandler) Create(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	if !h.checkPlan(r, "pro", "physique_pro", "enterprise", "moral_team", "moral_enterprise") {
		jsonError(w, "Le module IRCM nécessite le plan Pro ou Enterprise.", http.StatusPaymentRequired)
		return
	}

	var req struct {
		Annee       int     `json:"annee"`
		MontantBrut float64 `json:"montant_brut"`
		TypeRevenu  string  `json:"type_revenu"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Annee < 2000 || req.MontantBrut <= 0 {
		jsonError(w, "annee (≥ 2000) et montant_brut (> 0) requis", http.StatusBadRequest)
		return
	}

	res := calc.CalcIRCM(req.MontantBrut, req.TypeRevenu)
	ref := fmt.Sprintf("IRCM-%d-%04d", req.Annee, time.Now().UnixNano()%10000)

	var d models.IRCMDeclaration
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO ircm_declarations
		 (company_id, annee, montant_brut, type_revenu, taux, ircm_total, montant_net, statut, ref)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,'brouillon',$8)
		 RETURNING `+ircmCols,
		companyID, req.Annee, res.Brut, req.TypeRevenu, res.Taux,
		res.IRCM, res.Net, ref,
	).Scan(
		&d.ID, &d.CompanyID, &d.Annee, &d.MontantBrut, &d.TypeRevenu, &d.Taux,
		&d.IRCMTotal, &d.MontantNet, &d.Statut, &d.Ref, &d.CreatedAt,
	)
	if err != nil {
		jsonError(w, "Erreur création déclaration IRCM", http.StatusInternalServerError)
		return
	}
	jsonCreated(w, d)
}

// GET /api/ircm/{id}
func (h *IRCMHandler) Get(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	var d models.IRCMDeclaration
	if err := scanIRCM(h.DB.QueryRow(r.Context(),
		`SELECT `+ircmCols+` FROM ircm_declarations WHERE id=$1 AND company_id=$2`, id, companyID,
	), &d); err != nil {
		jsonError(w, "Déclaration IRCM introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, d)
}

// PATCH /api/ircm/{id}/valider
func (h *IRCMHandler) Valider(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.DB.Exec(r.Context(),
		`UPDATE ircm_declarations SET statut='declare' WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Déclaration IRCM introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, map[string]string{"statut": "declare"})
}

// DELETE /api/ircm/{id}
func (h *IRCMHandler) Delete(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM ircm_declarations WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Déclaration IRCM introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/ircm/{id}/export
func (h *IRCMHandler) Export(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	var d models.IRCMDeclaration
	if err := scanIRCM(h.DB.QueryRow(r.Context(),
		`SELECT `+ircmCols+` FROM ircm_declarations WHERE id=$1 AND company_id=$2`, id, companyID,
	), &d); err != nil {
		jsonError(w, "Déclaration IRCM introuvable", http.StatusNotFound)
		return
	}

	ref := ""
	if d.Ref != nil {
		ref = *d.Ref
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="IRCM-%d.csv"`, d.Annee))
	cw := csv.NewWriter(w)
	cw.Write([]string{"Référence", "Année", "Type revenu", "Montant brut", "Taux", "IRCM dû", "Montant net", "Statut"})
	cw.Write([]string{
		ref,
		strconv.Itoa(d.Annee),
		d.TypeRevenu,
		strconv.FormatFloat(d.MontantBrut, 'f', 0, 64),
		strconv.FormatFloat(d.Taux*100, 'f', 1, 64) + "%",
		strconv.FormatFloat(d.IRCMTotal, 'f', 0, 64),
		strconv.FormatFloat(d.MontantNet, 'f', 0, 64),
		d.Statut,
	})
	cw.Flush()
}
