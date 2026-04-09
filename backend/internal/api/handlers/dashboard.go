package handlers

import (
	"net/http"
	"time"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DashboardHandler struct {
	DB *pgxpool.Pool
}

func NewDashboardHandler(db *pgxpool.Pool) *DashboardHandler {
	return &DashboardHandler{DB: db}
}

type DashboardData struct {
	NbEmployes     int            `json:"nb_employes"`
	NbDeclarations int            `json:"nb_declarations"`
	MoisCourant    DashboardMois  `json:"mois_courant"`
	MoisPrecedent  DashboardMois  `json:"mois_precedent"`
	EvolutionIUTS  float64        `json:"evolution_iuts_pct"` // % variation vs mois précédent
	EvolutionBrut  float64        `json:"evolution_brut_pct"`
	TotalAnnee     DashboardAnnee `json:"total_annee"`
	AlertesRetard  []AlerteRetard `json:"alertes_retard"`
	PlanInfo       PlanInfo       `json:"plan"`
}

type DashboardMois struct {
	Mois       int     `json:"mois"`
	Annee      int     `json:"annee"`
	Periode    string  `json:"periode"`
	BrutTotal  float64 `json:"brut_total"`
	IUTSTotal  float64 `json:"iuts_total"`
	TPATotal   float64 `json:"tpa_total"`
	CSSTotal   float64 `json:"css_total"`
	Total      float64 `json:"total"`
	NbSalaries int     `json:"nb_salaries"`
	Statut     string  `json:"statut"`
}

type DashboardAnnee struct {
	Annee     int     `json:"annee"`
	BrutTotal float64 `json:"brut_total"`
	IUTSTotal float64 `json:"iuts_total"`
	TPATotal  float64 `json:"tpa_total"`
	CSSTotal  float64 `json:"css_total"`
	Total     float64 `json:"total"`
}

type AlerteRetard struct {
	DeclarationID string `json:"declaration_id"`
	Ref           string `json:"ref"`
	Periode       string `json:"periode"`
	Mois          int    `json:"mois"`
	Annee         int    `json:"annee"`
	Statut        string `json:"statut"`
}

type PlanInfo struct {
	Plan       string `json:"plan"`
	NbEmployes int    `json:"nb_employes"`
	LimiteEmp  int    `json:"limite_employes"` // -1 = illimité
}

// GET /api/dashboard
func (h *DashboardHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var companyID string
	err := h.DB.QueryRow(r.Context(),
		`SELECT id FROM companies WHERE user_id=$1 LIMIT 1`, userID).Scan(&companyID)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	now := time.Now()
	moisCourant := now.Month()
	anneeCourante := now.Year()

	prevTime := now.AddDate(0, -1, 0)
	moisPrec := int(prevTime.Month())
	anneePrec := prevTime.Year()

	data := DashboardData{}

	// Compte employés
	h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM employees WHERE company_id=$1`, companyID).Scan(&data.NbEmployes)

	// Compte déclarations
	h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM declarations WHERE company_id=$1`, companyID).Scan(&data.NbDeclarations)

	// Plan
	var plan string
	h.DB.QueryRow(r.Context(), `SELECT plan FROM users WHERE id=$1`, userID).Scan(&plan)
	limiteEmp := 10
	if plan == "pro" || plan == "enterprise" {
		limiteEmp = -1
	}
	data.PlanInfo = PlanInfo{Plan: plan, NbEmployes: data.NbEmployes, LimiteEmp: limiteEmp}

	// Mois courant
	data.MoisCourant = h.getMois(r, companyID, int(moisCourant), anneeCourante)
	// Mois précédent
	data.MoisPrecedent = h.getMois(r, companyID, moisPrec, anneePrec)

	// Évolution %
	if data.MoisPrecedent.IUTSTotal > 0 {
		data.EvolutionIUTS = ((data.MoisCourant.IUTSTotal - data.MoisPrecedent.IUTSTotal) / data.MoisPrecedent.IUTSTotal) * 100
	}
	if data.MoisPrecedent.BrutTotal > 0 {
		data.EvolutionBrut = ((data.MoisCourant.BrutTotal - data.MoisPrecedent.BrutTotal) / data.MoisPrecedent.BrutTotal) * 100
	}

	// Total année courante
	row := h.DB.QueryRow(r.Context(),
		`SELECT COALESCE(SUM(brut_total),0), COALESCE(SUM(iuts_total),0),
		        COALESCE(SUM(tpa_total),0), COALESCE(SUM(css_total),0), COALESCE(SUM(total),0)
		 FROM declarations WHERE company_id=$1 AND annee=$2`, companyID, anneeCourante)
	row.Scan(&data.TotalAnnee.BrutTotal, &data.TotalAnnee.IUTSTotal,
		&data.TotalAnnee.TPATotal, &data.TotalAnnee.CSSTotal, &data.TotalAnnee.Total)
	data.TotalAnnee.Annee = anneeCourante

	// Alertes retard : déclarations des 3 derniers mois passés, pas en statut approuvé/ok
	// Une déclaration est en retard si on est après le 20 du mois suivant la période
	rows, err := h.DB.Query(r.Context(),
		`SELECT id, COALESCE(ref,''), periode, mois, annee, statut
		 FROM declarations
		 WHERE company_id=$1
		   AND statut NOT IN ('approuve','ok')
		   AND (annee < $2 OR (annee = $2 AND mois < $3))
		 ORDER BY annee DESC, mois DESC
		 LIMIT 6`,
		companyID, anneeCourante, int(moisCourant))
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var a AlerteRetard
			if rows.Scan(&a.DeclarationID, &a.Ref, &a.Periode, &a.Mois, &a.Annee, &a.Statut) == nil {
				// Vérifier si on est après le 20 du mois suivant
				echeance := time.Date(a.Annee, time.Month(a.Mois+1), 20, 0, 0, 0, 0, time.UTC)
				if now.After(echeance) {
					data.AlertesRetard = append(data.AlertesRetard, a)
				}
			}
		}
	}
	if data.AlertesRetard == nil {
		data.AlertesRetard = []AlerteRetard{}
	}

	jsonOK(w, data)
}

func (h *DashboardHandler) getMois(r *http.Request, companyID string, mois, annee int) DashboardMois {
	var m DashboardMois
	m.Mois = mois
	m.Annee = annee
	noms := map[int]string{
		1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
		5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
		9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
	}
	m.Periode = noms[mois]
	h.DB.QueryRow(r.Context(),
		`SELECT COALESCE(brut_total,0), COALESCE(iuts_total,0), COALESCE(tpa_total,0),
		        COALESCE(css_total,0), COALESCE(total,0), COALESCE(nb_salaries,0), COALESCE(statut,'')
		 FROM declarations WHERE company_id=$1 AND mois=$2 AND annee=$3
		 ORDER BY created_at DESC LIMIT 1`,
		companyID, mois, annee,
	).Scan(&m.BrutTotal, &m.IUTSTotal, &m.TPATotal, &m.CSSTotal, &m.Total, &m.NbSalaries, &m.Statut)
	return m
}
