package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ExerciceHandler struct {
	DB *pgxpool.Pool
}

func NewExerciceHandler(db *pgxpool.Pool) *ExerciceHandler {
	return &ExerciceHandler{DB: db}
}

// companyIDForUser retourne le company_id de l'utilisateur courant.
func (h *ExerciceHandler) companyID(r *http.Request) (string, error) {
	id := middleware.GetCompanyID(r)
	if id == "" {
		return "", fmt.Errorf("company not found")
	}
	return id, nil
}

func scanExercice(row interface {
	Scan(...any) error
}, e *models.ExerciceFiscal) error {
	return row.Scan(
		&e.ID, &e.CompanyID, &e.Annee,
		&e.DateDebut, &e.DateFin,
		&e.Statut, &e.DateCloture, &e.Note, &e.CreatedAt,
	)
}

// GET /api/exercice — liste tous les exercices de la société
func (h *ExerciceHandler) List(w http.ResponseWriter, r *http.Request) {
	cid, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	rows, err := h.DB.Query(r.Context(),
		`SELECT id, company_id, annee,
		        TO_CHAR(date_debut,'YYYY-MM-DD'), TO_CHAR(date_fin,'YYYY-MM-DD'),
		        statut, date_cloture, note, created_at
		 FROM exercices_fiscaux
		 WHERE company_id=$1
		 ORDER BY annee DESC`, cid)
	if err != nil {
		jsonError(w, "Erreur base de données", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	list := []models.ExerciceFiscal{}
	for rows.Next() {
		var e models.ExerciceFiscal
		if err := scanExercice(rows, &e); err == nil {
			list = append(list, e)
		}
	}
	jsonOK(w, list)
}

// GET /api/exercice/actif — retourne l'exercice en cours (statut='en_cours')
func (h *ExerciceHandler) Actif(w http.ResponseWriter, r *http.Request) {
	cid, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var e models.ExerciceFiscal
	row := h.DB.QueryRow(r.Context(),
		`SELECT id, company_id, annee,
		        TO_CHAR(date_debut,'YYYY-MM-DD'), TO_CHAR(date_fin,'YYYY-MM-DD'),
		        statut, date_cloture, note, created_at
		 FROM exercices_fiscaux
		 WHERE company_id=$1 AND statut='en_cours'
		 ORDER BY annee DESC LIMIT 1`, cid)
	if err := scanExercice(row, &e); err != nil {
		// Pas d'exercice actif : renvoie null sans erreur
		jsonOK(w, nil)
		return
	}
	jsonOK(w, e)
}

// POST /api/exercice — crée un nouvel exercice
func (h *ExerciceHandler) Create(w http.ResponseWriter, r *http.Request) {
	cid, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	var body struct {
		Annee     int    `json:"annee"`
		DateDebut string `json:"date_debut"` // "YYYY-MM-DD"
		DateFin   string `json:"date_fin"`   // "YYYY-MM-DD"
		Note      string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Annee == 0 {
		jsonError(w, "Données invalides (annee requis)", http.StatusBadRequest)
		return
	}

	// Valeurs par défaut : 1er janv → 31 déc de l'année indiquée
	if body.DateDebut == "" {
		body.DateDebut = fmt.Sprintf("%d-01-01", body.Annee)
	}
	if body.DateFin == "" {
		body.DateFin = fmt.Sprintf("%d-12-31", body.Annee)
	}

	// Vérifier qu'il n'y a pas déjà un exercice en cours
	var countActif int
	h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM exercices_fiscaux WHERE company_id=$1 AND statut='en_cours'`, cid,
	).Scan(&countActif)
	if countActif > 0 {
		jsonError(w, "Un exercice est déjà en cours. Clôturez-le avant d'en ouvrir un nouveau.", http.StatusConflict)
		return
	}

	var e models.ExerciceFiscal
	row := h.DB.QueryRow(r.Context(),
		`INSERT INTO exercices_fiscaux (company_id, annee, date_debut, date_fin, statut, note)
		 VALUES ($1, $2, $3::date, $4::date, 'en_cours', $5)
		 ON CONFLICT (company_id, annee) DO NOTHING
		 RETURNING id, company_id, annee,
		           TO_CHAR(date_debut,'YYYY-MM-DD'), TO_CHAR(date_fin,'YYYY-MM-DD'),
		           statut, date_cloture, note, created_at`,
		cid, body.Annee, body.DateDebut, body.DateFin, body.Note,
	)
	if err := scanExercice(row, &e); err != nil {
		jsonError(w, "Cet exercice existe déjà pour cette année", http.StatusConflict)
		return
	}
	jsonCreated(w, e)
}

// PUT /api/exercice/{id}/cloturer — clôture l'exercice
func (h *ExerciceHandler) Cloturer(w http.ResponseWriter, r *http.Request) {
	cid, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")
	now := time.Now()

	tag, err := h.DB.Exec(r.Context(),
		`UPDATE exercices_fiscaux
		 SET statut='cloture', date_cloture=$1
		 WHERE id=$2 AND company_id=$3 AND statut='en_cours'`,
		now, id, cid,
	)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Exercice introuvable ou déjà clôturé", http.StatusBadRequest)
		return
	}
	jsonOK(w, map[string]string{"statut": "cloture", "date_cloture": now.Format(time.RFC3339)})
}

// PUT /api/exercice/{id} — met à jour note/dates d'un exercice en cours
func (h *ExerciceHandler) Update(w http.ResponseWriter, r *http.Request) {
	cid, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	id := chi.URLParam(r, "id")

	var body struct {
		DateDebut string `json:"date_debut"`
		DateFin   string `json:"date_fin"`
		Note      string `json:"note"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	tag, err := h.DB.Exec(r.Context(),
		`UPDATE exercices_fiscaux
		 SET date_debut=COALESCE(NULLIF($1,'')::date, date_debut),
		     date_fin=COALESCE(NULLIF($2,'')::date, date_fin),
		     note=$3
		 WHERE id=$4 AND company_id=$5`,
		body.DateDebut, body.DateFin, body.Note, id, cid,
	)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Exercice introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, map[string]string{"status": "updated"})
}
