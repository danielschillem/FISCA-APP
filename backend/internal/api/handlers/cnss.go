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
	"github.com/fisca-app/backend/internal/calc"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Taux CNSS Burkina Faso - CGI 2025 / Code du Travail
const (
	// Patronal : Famille 7,2 % + Accident 3,4 % + Retraite 5,5 % = 16,1 %
	TauxPatronalCNSS  = 16.1 // % de la base cotisable (employeur)
	TauxSalarialCNSS  = 5.5  // % de la base cotisable (salarié, retraite)
	TauxPatronalCARFO = 7.0  // % de la base cotisable (employeur)
	TauxSalarialCARFO = 6.0  // % de la base cotisable (salarié)
)

type CNSSHandler struct {
	DB *pgxpool.Pool
}

func NewCNSSHandler(db *pgxpool.Pool) *CNSSHandler {
	return &CNSSHandler{DB: db}
}

func (h *CNSSHandler) companyID(r *http.Request) (string, error) {
	id := middleware.GetCompanyID(r)
	if id == "" {
		return "", fmt.Errorf("company not found")
	}
	return id, nil
}

const cnssCols = `id, company_id, periode, mois, annee,
	nb_salaries_cnss, nb_salaries_carfo, base_cnss, base_carfo,
	cotisation_pat_cnss, cotisation_sal_cnss, cotisation_pat_carfo, cotisation_sal_carfo,
	total_cnss, total_carfo, total_general, statut, created_at`

func scanCNSS(row interface{ Scan(...any) error }, d *models.CNSSPatronal) error {
	return row.Scan(
		&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
		&d.NbSalariesCNSS, &d.NbSalariesCARFO, &d.BaseCNSS, &d.BaseCARFO,
		&d.CotisationPatCNSS, &d.CotisationSalCNSS, &d.CotisationPatCARFO, &d.CotisationSalCARFO,
		&d.TotalCNSS, &d.TotalCARFO, &d.TotalGeneral, &d.Statut, &d.CreatedAt,
	)
}

// round2 arrondit à 2 décimales
func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

// GET /api/cnss
func (h *CNSSHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	q := r.URL.Query()
	mois := q.Get("mois")
	annee := q.Get("annee")

	countQuery := `SELECT COUNT(*) FROM cnss_patronal WHERE company_id=$1`
	query := `SELECT ` + cnssCols + ` FROM cnss_patronal WHERE company_id=$1`
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
	query += " ORDER BY annee DESC, mois DESC"

	var total int
	h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	items := []models.CNSSPatronal{}
	for rows.Next() {
		var d models.CNSSPatronal
		if err := scanCNSS(rows, &d); err == nil {
			items = append(items, d)
		}
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	jsonOK(w, items)
}

// POST /api/cnss/generer - génère la fiche CNSS patronal depuis la déclaration du mois
func (h *CNSSHandler) Generer(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var req struct {
		Mois  int `json:"mois"`
		Annee int `json:"annee"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Corps invalide", http.StatusBadRequest)
		return
	}
	if req.Mois < 1 || req.Mois > 12 || req.Annee < 2000 {
		jsonError(w, "Période invalide", http.StatusBadRequest)
		return
	}

	// Récupérer les bulletins de la période pour calcul CNSS par employé
	rows, err := h.DB.Query(r.Context(),
		`SELECT cotisation, brut_total FROM bulletins
		 WHERE company_id=$1 AND mois=$2 AND annee=$3`,
		companyID, req.Mois, req.Annee)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Agréger via CalcCNSSPatronal (applique le plafond 600k par employé)
	var baseCNSS, baseCARFO float64
	var patCNSS, salCNSS, patCARFO, salCARFO float64
	var nbCNSS, nbCARFO int
	for rows.Next() {
		var cot string
		var brut float64
		if err := rows.Scan(&cot, &brut); err != nil {
			continue
		}
		res := calc.CalcCNSSPatronal(brut, cot)
		if strings.EqualFold(cot, "CARFO") {
			baseCARFO += res.BasePlafond
			patCARFO += res.TotalPatronal
			salCARFO += res.CotSalariale
			nbCARFO++
		} else {
			baseCNSS += res.BasePlafond
			patCNSS += res.TotalPatronal
			salCNSS += res.CotSalariale
			nbCNSS++
		}
	}

	// Si aucun bulletin, estimer depuis la déclaration
	// css_total = somme des cotisations salariales (CNSS 5.5% + CARFO 6%)
	// On ne peut pas distinguer CNSS/CARFO sans bulletins → estimation conservative via taux moyen.
	// La base est divisée par le taux CNSS (5.5%) pour obtenir un plancher prudent.
	if nbCNSS+nbCARFO == 0 {
		var cssTotal float64
		h.DB.QueryRow(r.Context(),
			`SELECT COALESCE(css_total,0) FROM declarations
			 WHERE company_id=$1 AND mois=$2 AND annee=$3 LIMIT 1`,
			companyID, req.Mois, req.Annee).Scan(&cssTotal)
		if cssTotal > 0 {
			// Estimation via taux salarial CNSS 5.5% (taux le plus bas → base la plus haute)
			// Si des employés sont CARFO (6%), la base réelle est légèrement inférieure.
			baseCNSS = math.Round(cssTotal / (TauxSalarialCNSS / 100))
			res := calc.CalcCNSSPatronal(baseCNSS, "CNSS")
			patCNSS = res.TotalPatronal
			salCNSS = res.CotSalariale
		}
	}

	patCNSS = round2(patCNSS)
	salCNSS = round2(salCNSS)
	patCARFO = round2(patCARFO)
	salCARFO = round2(salCARFO)
	totalCNSS := round2(patCNSS + salCNSS)
	totalCARFO := round2(patCARFO + salCARFO)
	totalGeneral := round2(totalCNSS + totalCARFO)
	periode := fmt.Sprintf("%s %d", moisLabel(req.Mois), req.Annee)

	var d models.CNSSPatronal
	err = scanCNSS(h.DB.QueryRow(r.Context(), `
		INSERT INTO cnss_patronal
			(company_id, periode, mois, annee,
			 nb_salaries_cnss, nb_salaries_carfo, base_cnss, base_carfo,
			 cotisation_pat_cnss, cotisation_sal_cnss, cotisation_pat_carfo, cotisation_sal_carfo,
			 total_cnss, total_carfo, total_general, statut)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'brouillon')
		ON CONFLICT (company_id, mois, annee) DO UPDATE SET
			nb_salaries_cnss=EXCLUDED.nb_salaries_cnss,
			nb_salaries_carfo=EXCLUDED.nb_salaries_carfo,
			base_cnss=EXCLUDED.base_cnss,
			base_carfo=EXCLUDED.base_carfo,
			cotisation_pat_cnss=EXCLUDED.cotisation_pat_cnss,
			cotisation_sal_cnss=EXCLUDED.cotisation_sal_cnss,
			cotisation_pat_carfo=EXCLUDED.cotisation_pat_carfo,
			cotisation_sal_carfo=EXCLUDED.cotisation_sal_carfo,
			total_cnss=EXCLUDED.total_cnss,
			total_carfo=EXCLUDED.total_carfo,
			total_general=EXCLUDED.total_general
		RETURNING `+cnssCols,
		companyID, periode, req.Mois, req.Annee,
		nbCNSS, nbCARFO, baseCNSS, baseCARFO,
		patCNSS, salCNSS, patCARFO, salCARFO,
		totalCNSS, totalCARFO, totalGeneral,
	), &d)
	if err != nil {
		jsonError(w, "Erreur génération: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonCreated(w, d)
}

// GET /api/cnss/{id}
func (h *CNSSHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	var d models.CNSSPatronal
	if err := scanCNSS(h.DB.QueryRow(r.Context(),
		`SELECT `+cnssCols+` FROM cnss_patronal WHERE id=$1 AND company_id=$2`,
		id, companyID), &d); err != nil {
		jsonError(w, "Fiche introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, d)
}

// PUT /api/cnss/{id}/valider
func (h *CNSSHandler) Valider(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	_, err = h.DB.Exec(r.Context(),
		`UPDATE cnss_patronal SET statut='valide' WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil {
		jsonError(w, "Erreur mise à jour", http.StatusInternalServerError)
		return
	}
	var d models.CNSSPatronal
	scanCNSS(h.DB.QueryRow(r.Context(),
		`SELECT `+cnssCols+` FROM cnss_patronal WHERE id=$1`, id), &d)
	jsonOK(w, d)
}

// DELETE /api/cnss/{id}
func (h *CNSSHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	h.DB.Exec(r.Context(),
		`DELETE FROM cnss_patronal WHERE id=$1 AND company_id=$2`, id, companyID)
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/cnss/{id}/export - Déclaration CSV
func (h *CNSSHandler) Export(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	var d models.CNSSPatronal
	if err := scanCNSS(h.DB.QueryRow(r.Context(),
		`SELECT `+cnssCols+` FROM cnss_patronal WHERE id=$1 AND company_id=$2`,
		id, companyID), &d); err != nil {
		jsonError(w, "Fiche introuvable", http.StatusNotFound)
		return
	}

	var nomSoc, ifu string
	h.DB.QueryRow(r.Context(), `SELECT nom, ifu FROM companies WHERE id=$1`, companyID).Scan(&nomSoc, &ifu)

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition",
		fmt.Sprintf(`attachment; filename="cnss_patronal_%s.csv"`, d.Periode))
	w.Write([]byte{0xEF, 0xBB, 0xBF}) //nolint:errcheck

	lines := [][]string{
		{"DÉCLARATION CNSS PATRONAL - BURKINA FASO"},
		{"Société", nomSoc, "IFU", ifu},
		{"Période", d.Periode},
		{"Date export", time.Now().Format("02/01/2006")},
		{},
		{"Régime", "Nbre salariés", "Base cotisable", "Part patronale (%)", "Part patronale (F CFA)", "Part salariale (%)", "Part salariale (F CFA)", "Total"},
		{"CNSS", fmt.Sprintf("%d", d.NbSalariesCNSS), fmt.Sprintf("%.2f", d.BaseCNSS),
			fmt.Sprintf("%.1f", TauxPatronalCNSS), fmt.Sprintf("%.2f", d.CotisationPatCNSS),
			fmt.Sprintf("%.1f", TauxSalarialCNSS), fmt.Sprintf("%.2f", d.CotisationSalCNSS),
			fmt.Sprintf("%.2f", d.TotalCNSS)},
		{"CARFO", fmt.Sprintf("%d", d.NbSalariesCARFO), fmt.Sprintf("%.2f", d.BaseCARFO),
			fmt.Sprintf("%.1f", TauxPatronalCARFO), fmt.Sprintf("%.2f", d.CotisationPatCARFO),
			fmt.Sprintf("%.1f", TauxSalarialCARFO), fmt.Sprintf("%.2f", d.CotisationSalCARFO),
			fmt.Sprintf("%.2f", d.TotalCARFO)},
		{},
		{"TOTAL GÉNÉRAL", "", "", "", "", "", "", fmt.Sprintf("%.2f", d.TotalGeneral)},
	}
	for _, row := range lines {
		w.Write([]byte(strings.Join(row, ";") + "\n")) //nolint:errcheck
	}
}
