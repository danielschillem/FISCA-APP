package handlers

import (
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

type DeclarationHandler struct {
	DB *pgxpool.Pool
}

func NewDeclarationHandler(db *pgxpool.Pool) *DeclarationHandler {
	return &DeclarationHandler{DB: db}
}

func (h *DeclarationHandler) companyID(r *http.Request) (string, error) {
	userID := middleware.GetUserID(r)
	var id string
	err := h.DB.QueryRow(r.Context(),
		`SELECT id FROM companies WHERE user_id=$1 LIMIT 1`, userID).Scan(&id)
	return id, err
}

// GET /api/declarations?page=1&limit=100
func (h *DeclarationHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
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

	rows, err := h.DB.Query(r.Context(),
		`SELECT id, company_id, periode, mois, annee, nb_salaries,
		        brut_total, iuts_total, tpa_total, css_total, total,
		        statut, ref, date_depot, created_at
		 FROM declarations WHERE company_id=$1 ORDER BY annee DESC, mois DESC
		 LIMIT $2 OFFSET $3`,
		companyID, limit, offset,
	)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	decls := []models.Declaration{}
	for rows.Next() {
		var d models.Declaration
		if err := rows.Scan(&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
			&d.NbSalarie, &d.BrutTotal, &d.IUTSTotal, &d.TPATotal,
			&d.CSSTotal, &d.Total, &d.Statut, &d.Ref, &d.DateDepot, &d.CreatedAt,
		); err != nil {
			continue
		}
		decls = append(decls, d)
	}
	jsonOK(w, decls)
}

// GET /api/declarations/{id}
func (h *DeclarationHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	var d models.Declaration
	err = h.DB.QueryRow(r.Context(),
		`SELECT id, company_id, periode, mois, annee, nb_salaries,
		        brut_total, iuts_total, tpa_total, css_total, total,
		        statut, ref, date_depot, created_at
		 FROM declarations WHERE id=$1 AND company_id=$2`,
		id, companyID,
	).Scan(&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
		&d.NbSalarie, &d.BrutTotal, &d.IUTSTotal, &d.TPATotal,
		&d.CSSTotal, &d.Total, &d.Statut, &d.Ref, &d.DateDepot, &d.CreatedAt)
	if err != nil {
		jsonError(w, "Déclaration introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, d)
}

// POST /api/declarations — Calcul + enregistrement à partir des employés
func (h *DeclarationHandler) Create(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var req struct {
		Mois       int    `json:"mois"`
		Annee      int    `json:"annee"`
		Cotisation string `json:"cotisation"` // "CNSS" | "CARFO" (ignoré, utilisé par employé)
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if req.Mois < 1 || req.Mois > 12 {
		jsonError(w, "Mois invalide : doit être entre 1 et 12", http.StatusBadRequest)
		return
	}
	if req.Annee < 2000 || req.Annee > 2100 {
		jsonError(w, "Année invalide", http.StatusBadRequest)
		return
	}

	// Récupérer les employés avec leur cotisation individuelle
	rows, err := h.DB.Query(r.Context(),
		`SELECT salaire_base, anciennete, heures_sup, logement, transport, fonction, charges, cotisation
		 FROM employees WHERE company_id=$1`, companyID)
	if err != nil {
		jsonError(w, "Erreur récupération employés", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var brutTotal, iutsTotal, tpaTotal, cssTotal float64
	nbSalaries := 0
	for rows.Next() {
		var e calc.SalarieInput
		if err := rows.Scan(&e.SalaireBase, &e.Anciennete, &e.HeuresSup,
			&e.Logement, &e.Transport, &e.Fonction, &e.Charges, &e.Cotisation); err != nil {
			continue
		}
		if e.Cotisation != "CARFO" {
			e.Cotisation = "CNSS"
		}
		res := calc.CalcSalarie(e)
		brutTotal += res.BrutTotal
		iutsTotal += res.IUTSNet
		tpaTotal += res.TPA
		cssTotal += res.CotSoc
		nbSalaries++
	}
	total := iutsTotal + tpaTotal

	periodeMap := map[int]string{
		1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
		5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
		9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
	}
	periode := fmt.Sprintf("%s %d", periodeMap[req.Mois], req.Annee)

	now := time.Now()
	ref := fmt.Sprintf("FISCA-%d%02d-%04d", req.Annee, req.Mois, now.UnixNano()%10000)

	// Délai légal BF : 15 du mois suivant la période
	// time.Month(mois+1) est normalisé par Go (décembre+1 = janvier N+1)
	deadline := time.Date(req.Annee, time.Month(req.Mois+1), 15, 23, 59, 59, 0, time.UTC)
	statut := "ok"
	if now.UTC().After(deadline) {
		statut = "retard"
	}

	var d models.Declaration
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO declarations
		 (company_id, periode, mois, annee, nb_salaries,
		  brut_total, iuts_total, tpa_total, css_total, total,
		  statut, ref, date_depot)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		 RETURNING id, company_id, periode, mois, annee, nb_salaries,
		   brut_total, iuts_total, tpa_total, css_total, total,
		   statut, ref, date_depot, created_at`,
		companyID, periode, req.Mois, req.Annee, nbSalaries,
		brutTotal, iutsTotal, tpaTotal, cssTotal, total,
		statut, ref, now,
	).Scan(&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee, &d.NbSalarie,
		&d.BrutTotal, &d.IUTSTotal, &d.TPATotal, &d.CSSTotal, &d.Total,
		&d.Statut, &d.Ref, &d.DateDepot, &d.CreatedAt)
	if err != nil {
		jsonError(w, "Erreur création déclaration", http.StatusInternalServerError)
		return
	}
	jsonCreated(w, d)
}

// DELETE /api/declarations/{id}
func (h *DeclarationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	tag, err := h.DB.Exec(r.Context(),
		`DELETE FROM declarations WHERE id=$1 AND company_id=$2`, id, companyID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Déclaration introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/declarations/{id}/export — Export CSV format DGI Burkina Faso
func (h *DeclarationHandler) Export(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var d models.Declaration
	err = h.DB.QueryRow(r.Context(),
		`SELECT id, company_id, periode, mois, annee, nb_salaries,
		        brut_total, iuts_total, tpa_total, css_total, total,
		        statut, ref, date_depot, created_at
		 FROM declarations WHERE id=$1 AND company_id=$2`,
		id, companyID,
	).Scan(&d.ID, &d.CompanyID, &d.Periode, &d.Mois, &d.Annee,
		&d.NbSalarie, &d.BrutTotal, &d.IUTSTotal, &d.TPATotal,
		&d.CSSTotal, &d.Total, &d.Statut, &d.Ref, &d.DateDepot, &d.CreatedAt)
	if err != nil {
		jsonError(w, "Déclaration introuvable", http.StatusNotFound)
		return
	}

	// Récupérer les informations de l'entreprise
	var nom, ifu string
	h.DB.QueryRow(r.Context(),
		`SELECT COALESCE(nom,''), COALESCE(ifu,'') FROM companies WHERE id=$1`, companyID,
	).Scan(&nom, &ifu)

	ref := ""
	if d.Ref != nil {
		ref = *d.Ref
	}

	// Format CSV télédéclaration DGI-BF (colonnes standard)
	filename := fmt.Sprintf("FISCA-IUTS-%d%02d-%s.csv", d.Annee, d.Mois, ref)
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	// BOM UTF-8 pour compatibilité Excel/LibreOffice
	w.Write([]byte("\xEF\xBB\xBF"))
	fmt.Fprintf(w, "REFERENCE;ENTREPRISE;IFU;PERIODE;MOIS;ANNEE;NB_SALARIES;BRUT_TOTAL;IUTS_TOTAL;TPA_TOTAL;CSS_TOTAL;TOTAL_DGI;STATUT;DATE_DEPOT\n")
	fmt.Fprintf(w, "%s;%s;%s;%s;%d;%d;%d;%.2f;%.2f;%.2f;%.2f;%.2f;%s;%s\n",
		ref, nom, ifu, d.Periode, d.Mois, d.Annee, d.NbSalarie,
		d.BrutTotal, d.IUTSTotal, d.TPATotal, d.CSSTotal, d.Total,
		d.Statut, d.CreatedAt.Format("02/01/2006"),
	)
}
