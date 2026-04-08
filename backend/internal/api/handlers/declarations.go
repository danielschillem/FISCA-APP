package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
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

// GET /api/declarations
func (h *DeclarationHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	rows, err := h.DB.Query(r.Context(),
		`SELECT id, company_id, periode, mois, annee, nb_salaries,
		        brut_total, iuts_total, tpa_total, css_total, total,
		        statut, ref, date_depot, created_at
		 FROM declarations WHERE company_id=$1 ORDER BY annee DESC, mois DESC`,
		companyID,
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
		Cotisation string `json:"cotisation"` // "CNSS" | "CARFO"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}

	// Récupérer les employés
	rows, err := h.DB.Query(r.Context(),
		`SELECT salaire_base, anciennete, heures_sup, logement, transport, fonction, charges
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
		e.Cotisation = req.Cotisation
		if req.Cotisation == "" {
			e.Cotisation = "CNSS"
		}
		if err := rows.Scan(&e.SalaireBase, &e.Anciennete, &e.HeuresSup,
			&e.Logement, &e.Transport, &e.Fonction, &e.Charges); err != nil {
			continue
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

	var d models.Declaration
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO declarations
		 (company_id, periode, mois, annee, nb_salaries,
		  brut_total, iuts_total, tpa_total, css_total, total,
		  statut, ref, date_depot)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ok',$11,$12)
		 RETURNING id, company_id, periode, mois, annee, nb_salaries,
		   brut_total, iuts_total, tpa_total, css_total, total,
		   statut, ref, date_depot, created_at`,
		companyID, periode, req.Mois, req.Annee, nbSalaries,
		brutTotal, iutsTotal, tpaTotal, cssTotal, total,
		ref, now,
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
