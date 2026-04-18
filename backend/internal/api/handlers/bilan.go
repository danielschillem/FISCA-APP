package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BilanHandler struct {
	DB *pgxpool.Pool
}

func NewBilanHandler(db *pgxpool.Pool) *BilanHandler { return &BilanHandler{DB: db} }

type BilanData struct {
	Annee        int     `json:"annee"`
	IUTS         float64 `json:"iuts"`
	TPA          float64 `json:"tpa"`
	CSS          float64 `json:"css"`
	RAS          float64 `json:"ras"`
	TVA          float64 `json:"tva"`
	CNSSPatronal float64 `json:"cnss_patronal"`
	IRF          float64 `json:"irf"`
	IRCM         float64 `json:"ircm"`
	IS           float64 `json:"is"`
	CME          float64 `json:"cme"`
	Patente      float64 `json:"patente"`
	Total        float64 `json:"total"`
}

// GET /api/bilan?annee=YYYY
func (h *BilanHandler) Get(w http.ResponseWriter, r *http.Request) {
	companyID := middleware.GetCompanyID(r)
	if companyID == "" {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	annee := time.Now().Year()
	if v, err := strconv.Atoi(r.URL.Query().Get("annee")); err == nil && v >= 2000 {
		annee = v
	}

	ctx := r.Context()
	b := BilanData{Annee: annee}

	// IUTS / TPA / CSS - déclarations mensuelles IUTS
	h.DB.QueryRow(ctx, //nolint:errcheck
		`SELECT COALESCE(SUM(iuts_total),0), COALESCE(SUM(tpa_total),0), COALESCE(SUM(css_total),0)
		 FROM declarations WHERE company_id=$1 AND annee=$2`,
		companyID, annee).Scan(&b.IUTS, &b.TPA, &b.CSS)

	// TVA nette collectée
	h.DB.QueryRow(ctx, //nolint:errcheck
		`SELECT COALESCE(SUM(tva_nette),0) FROM tva_declarations WHERE company_id=$1 AND annee=$2`,
		companyID, annee).Scan(&b.TVA)

	// Retenues à la source
	h.DB.QueryRow(ctx, //nolint:errcheck
		`SELECT COALESCE(SUM(montant_retenue),0) FROM retenues_source WHERE company_id=$1 AND annee=$2`,
		companyID, annee).Scan(&b.RAS)

	// CNSS Patronal
	h.DB.QueryRow(ctx, //nolint:errcheck
		`SELECT COALESCE(SUM(total_general),0) FROM cnss_patronal WHERE company_id=$1 AND annee=$2`,
		companyID, annee).Scan(&b.CNSSPatronal)

	// IRF - Revenus Fonciers
	h.DB.QueryRow(ctx, //nolint:errcheck
		`SELECT COALESCE(SUM(irf_total),0) FROM irf_declarations WHERE company_id=$1 AND annee=$2`,
		companyID, annee).Scan(&b.IRF)

	// IRCM - Capitaux Mobiliers
	h.DB.QueryRow(ctx, //nolint:errcheck
		`SELECT COALESCE(SUM(ircm_total),0) FROM ircm_declarations WHERE company_id=$1 AND annee=$2`,
		companyID, annee).Scan(&b.IRCM)

	// IS - Impôt sur les Sociétés
	h.DB.QueryRow(ctx, //nolint:errcheck
		`SELECT COALESCE(SUM(is_du),0) FROM is_declarations WHERE company_id=$1 AND annee=$2`,
		companyID, annee).Scan(&b.IS)

	// CME - Contribution Micro-Entreprises
	h.DB.QueryRow(ctx, //nolint:errcheck
		`SELECT COALESCE(SUM(cme_net),0) FROM cme_declarations WHERE company_id=$1 AND annee=$2`,
		companyID, annee).Scan(&b.CME)

	// Patente Professionnelle
	h.DB.QueryRow(ctx, //nolint:errcheck
		`SELECT COALESCE(SUM(total_patente),0) FROM patente_declarations WHERE company_id=$1 AND annee=$2`,
		companyID, annee).Scan(&b.Patente)

	b.Total = b.IUTS + b.TPA + b.CSS + b.RAS + b.TVA + b.CNSSPatronal +
		b.IRF + b.IRCM + b.IS + b.CME + b.Patente

	jsonOK(w, b)
}
