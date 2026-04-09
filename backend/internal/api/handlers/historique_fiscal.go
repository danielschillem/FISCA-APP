package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HistoriqueFiscalHandler struct {
	DB *pgxpool.Pool
}

func NewHistoriqueFiscalHandler(db *pgxpool.Pool) *HistoriqueFiscalHandler {
	return &HistoriqueFiscalHandler{DB: db}
}

func (h *HistoriqueFiscalHandler) companyID(r *http.Request) (string, error) {
	userID := middleware.GetUserID(r)
	var id string
	err := h.DB.QueryRow(r.Context(),
		`SELECT id FROM companies WHERE user_id=$1 LIMIT 1`, userID).Scan(&id)
	return id, err
}

// GET /api/historique-fiscal?annee=2026
func (h *HistoriqueFiscalHandler) Get(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	annee := time.Now().Year()
	if a := r.URL.Query().Get("annee"); a != "" {
		if v, e := strconv.Atoi(a); e == nil && v >= 2000 {
			annee = v
		}
	}

	// Données par mois depuis les déclarations IUTS
	type declRow struct {
		mois int
		iuts float64
		tpa  float64
		css  float64
	}
	rows, err := h.DB.Query(r.Context(),
		`SELECT mois, COALESCE(iuts_total,0), COALESCE(tpa_total,0), COALESCE(css_total,0)
		 FROM declarations WHERE company_id=$1 AND annee=$2
		 ORDER BY mois`, companyID, annee)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	declByMois := map[int]declRow{}
	for rows.Next() {
		var dr declRow
		rows.Scan(&dr.mois, &dr.iuts, &dr.tpa, &dr.css)
		declByMois[dr.mois] = dr
	}

	// CNSS Patronal par mois
	cnssRows, _ := h.DB.Query(r.Context(),
		`SELECT mois, COALESCE(total_general,0) FROM cnss_patronal
		 WHERE company_id=$1 AND annee=$2 ORDER BY mois`, companyID, annee)
	defer cnssRows.Close()
	cnssByMois := map[int]float64{}
	for cnssRows.Next() {
		var m int
		var total float64
		cnssRows.Scan(&m, &total)
		cnssByMois[m] = total
	}

	// TVA nette par mois
	tvaRows, _ := h.DB.Query(r.Context(),
		`SELECT mois, COALESCE(tva_nette,0) FROM tva_declarations
		 WHERE company_id=$1 AND annee=$2 ORDER BY mois`, companyID, annee)
	defer tvaRows.Close()
	tvaByMois := map[int]float64{}
	for tvaRows.Next() {
		var m int
		var tva float64
		tvaRows.Scan(&m, &tva)
		tvaByMois[m] = tva
	}

	// Retenues à la source par mois
	retRows, _ := h.DB.Query(r.Context(),
		`SELECT mois, COALESCE(SUM(montant_retenue),0) FROM retenues_source
		 WHERE company_id=$1 AND annee=$2 GROUP BY mois ORDER BY mois`, companyID, annee)
	defer retRows.Close()
	retByMois := map[int]float64{}
	for retRows.Next() {
		var m int
		var total float64
		retRows.Scan(&m, &total)
		retByMois[m] = total
	}

	moisLabels := []string{"", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
		"Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"}

	result := models.HistoriqueFiscalAnnee{Annee: annee}

	for m := 1; m <= 12; m++ {
		dr := declByMois[m]
		cnss := cnssByMois[m]
		tva := tvaByMois[m]
		ret := retByMois[m]
		total := dr.iuts + dr.tpa + dr.css + cnss + tva + ret

		moisData := models.HistoriqueFiscalMois{
			Mois:         m,
			Periode:      moisLabels[m],
			IUTSTotal:    dr.iuts,
			TPATotal:     dr.tpa,
			CSSTotal:     dr.css,
			CNSSPatronal: cnss,
			TVANette:     tva,
			RetenueTotal: ret,
			TotalOblig:   total,
		}
		result.Mois = append(result.Mois, moisData)

		result.IUTSTotal += dr.iuts
		result.TPATotal += dr.tpa
		result.CSSTotal += dr.css
		result.CNSSPatronal += cnss
		result.TVANette += tva
		result.RetenueTotal += ret
		result.TotalOblig += total
	}

	jsonOK(w, result)
}

// GET /api/historique-fiscal/annees — liste des années disponibles
func (h *HistoriqueFiscalHandler) Annees(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	rows, err := h.DB.Query(r.Context(),
		`SELECT DISTINCT annee FROM declarations WHERE company_id=$1
		 UNION SELECT DISTINCT annee FROM tva_declarations WHERE company_id=$1
		 UNION SELECT DISTINCT annee FROM retenues_source WHERE company_id=$1
		 ORDER BY annee DESC`, companyID)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	annees := []int{}
	for rows.Next() {
		var a int
		rows.Scan(&a)
		annees = append(annees, a)
	}
	if len(annees) == 0 {
		annees = []int{time.Now().Year()}
	}
	jsonOK(w, annees)
}
