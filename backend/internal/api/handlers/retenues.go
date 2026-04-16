package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Taux de retenue à la source BF — CGI 2025
// Les clés CGI 2025 (majuscules) correspondent au calculateur stateless /api/calcul/ras.
// Les clés légacy (minuscules) sont conservées pour compatibilité avec les enregistrements existants.
var TauxRetenue = map[string]float64{
	// ── CGI 2025 Art. 206-226 (clés canoniques) ──────────────────────────
	"RESIDENT_IFU":        5.0,  // résident avec IFU : 5 %
	"RESIDENT_IFU_IMMO":   1.0,  // résident IFU immo/TP : 1 %
	"RESIDENT_SANS_IFU":   25.0, // résident sans IFU : 25 %
	"TRAVAIL_TEMPORAIRE":  2.0,  // travail temporaire : 2 %
	"NON_RESIDENT":        20.0, // non-résident : 20 % (pas de seuil d'exonération)
	"NON_RESIDENT_CEDEAO": 10.0, // non-résident CEDEAO transport : 10 %
	"NONDETER_VACATION":   2.0,  // non-déterminé vacation/manuel : 2 %
	"NONDETER_PUBLIC":     5.0,  // non-déterminé entité publique : 5 %
	"NONDETER_SALARIE":    10.0, // non-déterminé salarié/intellectuel : 10 %
	"COMMANDE_PUBLIQUE":   5.0,  // commande publique : 5 %
	"COMMANDE_PUB_BIENS":  1.0,  // commande pub. biens/TP : 1 %
	// ── Clés légacy (rétro-compat enregistrements existants) ─────────────
	// IRF CGI 2025 Art. 121-126 : taux effectif minimum 9 % (loyer ≤ 200k FCFA/mois).
	// Pour loyers importants, utiliser le module IRF dédié (/api/irf).
	"services":   5.0,  // → RESIDENT_IFU
	"loyer":      9.0,  // → approximation IRF simple (utiliser /api/irf pour calcul exact)
	"dividendes": 12.5, // → IRCM CGI 2025 Art. 140 dividendes
	"interets":   25.0, // → IRCM CGI 2025 Art. 140 créances
	"autre":      25.0, // → RESIDENT_SANS_IFU
}

type RetenueHandler struct {
	DB *pgxpool.Pool
}

func NewRetenueHandler(db *pgxpool.Pool) *RetenueHandler {
	return &RetenueHandler{DB: db}
}

func (h *RetenueHandler) companyID(r *http.Request) (string, error) {
	id := middleware.GetCompanyID(r)
	if id == "" {
		return "", fmt.Errorf("company not found")
	}
	return id, nil
}

const retenueCols = `id, company_id, periode, mois, annee,
	beneficiaire, type_retenue,
	montant_brut, taux_retenue, montant_retenue, montant_net,
	statut, ref, created_at`

func scanRetenue(row interface{ Scan(...any) error }, d *models.RetenueSource) error {
	return row.Scan(
		&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
		&d.Beneficiaire, &d.TypeRetenue,
		&d.MontantBrut, &d.TauxRetenue, &d.MontantRetenue, &d.MontantNet,
		&d.Statut, &d.Ref, &d.CreatedAt,
	)
}

func moisLabel(m int) string {
	labels := []string{"", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
		"Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"}
	if m < 1 || m > 12 {
		return ""
	}
	return labels[m]
}

// GET /api/retenues
func (h *RetenueHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	q := r.URL.Query()
	mois := q.Get("mois")
	annee := q.Get("annee")

	countQuery := `SELECT COUNT(*) FROM retenues_source WHERE company_id=$1`
	query := `SELECT ` + retenueCols + ` FROM retenues_source WHERE company_id=$1`
	args := []any{companyID}
	idx := 2
	if mois != "" {
		clause := fmt.Sprintf(" AND mois=$%d", idx)
		query += clause
		countQuery += clause
		args = append(args, mois)
		idx++
	}
	if annee != "" {
		clause := fmt.Sprintf(" AND annee=$%d", idx)
		query += clause
		countQuery += clause
		args = append(args, annee)
	}
	query += " ORDER BY annee DESC, mois DESC, created_at DESC"

	var total int
	h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	items := []models.RetenueSource{}
	for rows.Next() {
		var d models.RetenueSource
		if err := scanRetenue(rows, &d); err == nil {
			items = append(items, d)
		}
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	jsonOK(w, items)
}

// POST /api/retenues
func (h *RetenueHandler) Create(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var req struct {
		Mois         int      `json:"mois"`
		Annee        int      `json:"annee"`
		Beneficiaire string   `json:"beneficiaire"`
		TypeRetenue  string   `json:"type_retenue"`
		MontantBrut  float64  `json:"montant_brut"`
		TauxCustom   *float64 `json:"taux_retenue"` // optionnel, sinon valeur par défaut type
		Ref          string   `json:"ref"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Corps invalide", http.StatusBadRequest)
		return
	}
	if req.Beneficiaire == "" {
		jsonError(w, "Bénéficiaire requis", http.StatusBadRequest)
		return
	}
	if req.Mois < 1 || req.Mois > 12 || req.Annee < 2000 {
		jsonError(w, "Période invalide", http.StatusBadRequest)
		return
	}
	if req.MontantBrut <= 0 {
		jsonError(w, "Montant brut invalide", http.StatusBadRequest)
		return
	}

	// Type par défaut
	if req.TypeRetenue == "" {
		req.TypeRetenue = "services"
	}

	// Taux: custom ou par défaut selon le type
	taux := TauxRetenue[req.TypeRetenue]
	if taux == 0 {
		taux = TauxRetenue["autre"]
	}
	if req.TauxCustom != nil && *req.TauxCustom > 0 {
		taux = *req.TauxCustom
	}

	// Arrondi au FCFA entier (FCFA est indivisible — pas de centimes)
	montantRetenue := math.Round(req.MontantBrut * taux / 100)
	montantNet := req.MontantBrut - montantRetenue
	periode := fmt.Sprintf("%s %d", moisLabel(req.Mois), req.Annee)

	var ref *string
	if req.Ref != "" {
		ref = &req.Ref
	}

	var d models.RetenueSource
	err = h.DB.QueryRow(r.Context(), `
		INSERT INTO retenues_source
			(company_id, periode, mois, annee, beneficiaire, type_retenue,
			 montant_brut, taux_retenue, montant_retenue, montant_net, statut, ref)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'en_cours',$11)
		RETURNING `+retenueCols,
		companyID, periode, req.Mois, req.Annee,
		req.Beneficiaire, req.TypeRetenue,
		req.MontantBrut, taux, montantRetenue, montantNet, ref,
	).Scan(
		&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
		&d.Beneficiaire, &d.TypeRetenue,
		&d.MontantBrut, &d.TauxRetenue, &d.MontantRetenue, &d.MontantNet,
		&d.Statut, &d.Ref, &d.CreatedAt,
	)
	if err != nil {
		jsonError(w, "Erreur création: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonCreated(w, d)
}

// GET /api/retenues/{id}
func (h *RetenueHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	var d models.RetenueSource
	err = scanRetenue(h.DB.QueryRow(r.Context(),
		`SELECT `+retenueCols+` FROM retenues_source WHERE id=$1 AND company_id=$2`,
		id, companyID), &d)
	if err != nil {
		jsonError(w, "Retenue introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, d)
}

// PUT /api/retenues/{id}
func (h *RetenueHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var req struct {
		Statut string `json:"statut"`
		Ref    string `json:"ref"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Corps invalide", http.StatusBadRequest)
		return
	}

	_, err = h.DB.Exec(r.Context(),
		`UPDATE retenues_source SET statut=$1, ref=NULLIF($2,'') WHERE id=$3 AND company_id=$4`,
		req.Statut, req.Ref, id, companyID)
	if err != nil {
		jsonError(w, "Erreur mise à jour", http.StatusInternalServerError)
		return
	}
	var d models.RetenueSource
	scanRetenue(h.DB.QueryRow(r.Context(),
		`SELECT `+retenueCols+` FROM retenues_source WHERE id=$1`, id), &d)
	jsonOK(w, d)
}

// DELETE /api/retenues/{id}
func (h *RetenueHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	_, err = h.DB.Exec(r.Context(),
		`DELETE FROM retenues_source WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil {
		jsonError(w, "Erreur suppression", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/retenues/{id}/export — CSV DGI-BF
func (h *RetenueHandler) Export(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	var d models.RetenueSource
	if err := scanRetenue(h.DB.QueryRow(r.Context(),
		`SELECT `+retenueCols+` FROM retenues_source WHERE id=$1 AND company_id=$2`,
		id, companyID), &d); err != nil {
		jsonError(w, "Retenue introuvable", http.StatusNotFound)
		return
	}

	// Récupérer infos société
	var nomSoc, ifu string
	h.DB.QueryRow(r.Context(), `SELECT nom, ifu FROM companies WHERE id=$1`, companyID).Scan(&nomSoc, &ifu)

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition",
		fmt.Sprintf(`attachment; filename="retenue_%s_%s.csv"`, d.Beneficiaire, d.Periode))
	// BOM UTF-8
	w.Write([]byte{0xEF, 0xBB, 0xBF}) //nolint:errcheck

	rows := [][]string{
		{"DÉCLARATION RETENUE À LA SOURCE — DGI BURKINA FASO"},
		{"Société", nomSoc, "IFU", ifu},
		{"Période", d.Periode},
		{"Date export", time.Now().Format("02/01/2006")},
		{},
		{"Bénéficiaire", "Type", "Montant brut", "Taux (%)", "Retenue", "Net versé", "Statut"},
		{d.Beneficiaire, strings.ToUpper(d.TypeRetenue),
			fmt.Sprintf("%.2f", d.MontantBrut),
			fmt.Sprintf("%.2f", d.TauxRetenue),
			fmt.Sprintf("%.2f", d.MontantRetenue),
			fmt.Sprintf("%.2f", d.MontantNet),
			d.Statut},
	}
	for _, row := range rows {
		w.Write([]byte(strings.Join(row, ";") + "\n")) //nolint:errcheck
	}
}

// GET /api/retenues/taux — taux par type
func (h *RetenueHandler) Taux(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, TauxRetenue)
}
