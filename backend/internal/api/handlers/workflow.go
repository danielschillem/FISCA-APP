package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Transitions autorisées : statut courant → étapes possibles
var workflowTransitions = map[string][]string{
	"en_cours":    {"soumis"},
	"ok":          {"soumis"},
	"retard":      {"soumis"}, // déclaration en retard : peut quand même être soumise
	"soumis":      {"en_revision", "approuve", "rejete"},
	"en_revision": {"approuve", "rejete"},
}

type WorkflowHandler struct {
	DB *pgxpool.Pool
}

func NewWorkflowHandler(db *pgxpool.Pool) *WorkflowHandler {
	return &WorkflowHandler{DB: db}
}

func (h *WorkflowHandler) companyID(r *http.Request) (string, error) {
	id := middleware.GetCompanyID(r)
	if id == "" {
		return "", fmt.Errorf("company not found")
	}
	return id, nil
}

// GET /api/workflow - liste des déclarations avec leur statut workflow
func (h *WorkflowHandler) List(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	statut := r.URL.Query().Get("statut")

	query := `
		SELECT d.id, d.statut, d.mois, d.annee, d.periode,
		       COALESCE(d.ref, '') AS ref,
		       COALESCE(u.email, '') AS createur,
		       COALESCE(we.commentaire, '') AS commentaire
		FROM declarations d
		LEFT JOIN companies c ON c.id = d.company_id
		LEFT JOIN users u ON u.id = c.user_id
		LEFT JOIN LATERAL (
		    SELECT COALESCE(commentaire, '') AS commentaire
		    FROM workflow_etapes
		    WHERE declaration_id = d.id
		    ORDER BY created_at DESC
		    LIMIT 1
		) we ON true
		WHERE d.company_id = $1`

	args := []any{companyID}
	if statut != "" {
		query += ` AND d.statut = $2`
		args = append(args, statut)
	}
	query += ` ORDER BY d.annee DESC, d.mois DESC`

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type WorkflowItem struct {
		ID              string `json:"id"`
		Statut          string `json:"statut"`
		TypeDeclaration string `json:"type_declaration"`
		Titre           string `json:"titre"`
		Mois            int    `json:"mois"`
		Annee           int    `json:"annee"`
		Createur        string `json:"createur"`
		Commentaire     string `json:"commentaire"`
	}

	items := []WorkflowItem{}
	for rows.Next() {
		var item WorkflowItem
		var ref string
		if err := rows.Scan(
			&item.ID, &item.Statut, &item.Mois, &item.Annee,
			&item.Titre, &ref, &item.Createur, &item.Commentaire,
		); err != nil {
			continue
		}
		item.TypeDeclaration = "declaration"
		items = append(items, item)
	}
	jsonOK(w, items)
}

// GET /api/declarations/{id}/workflow - historique des étapes
func (h *WorkflowHandler) History(w http.ResponseWriter, r *http.Request) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	declID := chi.URLParam(r, "id")

	// Vérifier appartenance
	var exists bool
	_ = h.DB.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM declarations WHERE id=$1 AND company_id=$2)`,
		declID, companyID).Scan(&exists)
	if !exists {
		jsonError(w, "Déclaration introuvable", http.StatusNotFound)
		return
	}

	rows, err := h.DB.Query(r.Context(),
		`SELECT id, declaration_id, etape, COALESCE(commentaire,''), user_id, created_at
		 FROM workflow_etapes WHERE declaration_id=$1 ORDER BY created_at ASC`, declID)
	if err != nil {
		jsonError(w, "Erreur DB", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	etapes := []models.WorkflowEtape{}
	for rows.Next() {
		var e models.WorkflowEtape
		if err := rows.Scan(&e.ID, &e.DeclarationID, &e.Etape, &e.Commentaire, &e.UserID, &e.CreatedAt); err != nil {
			continue
		}
		etapes = append(etapes, e)
	}
	jsonOK(w, etapes)
}

// POST /api/declarations/{id}/soumettre
func (h *WorkflowHandler) Soumettre(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "soumis")
}

// POST /api/declarations/{id}/approuver
func (h *WorkflowHandler) Approuver(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "approuve")
}

// POST /api/declarations/{id}/rejeter
func (h *WorkflowHandler) Rejeter(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "rejete")
}

// transition exécute un changement d'étape sur la déclaration.
func (h *WorkflowHandler) transition(w http.ResponseWriter, r *http.Request, toEtape string) {
	companyID, err := h.companyID(r)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	userID := middleware.GetUserID(r)
	declID := chi.URLParam(r, "id")

	var req struct {
		Commentaire string `json:"commentaire"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	// Lire le statut courant
	var statut string
	err = h.DB.QueryRow(r.Context(),
		`SELECT statut FROM declarations WHERE id=$1 AND company_id=$2`,
		declID, companyID).Scan(&statut)
	if err != nil {
		jsonError(w, "Déclaration introuvable", http.StatusNotFound)
		return
	}

	// Vérifier la transition
	allowed := workflowTransitions[statut]
	ok := false
	for _, a := range allowed {
		if a == toEtape {
			ok = true
			break
		}
	}
	if !ok {
		jsonError(w, "Transition non autorisée depuis le statut '"+statut+"'", http.StatusConflict)
		return
	}

	// Enregistrer l'étape et mettre à jour le statut
	var etape models.WorkflowEtape
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO workflow_etapes (declaration_id, etape, commentaire, user_id)
		 VALUES ($1,$2,$3,$4)
		 RETURNING id, declaration_id, etape, COALESCE(commentaire,''), user_id, created_at`,
		declID, toEtape, req.Commentaire, userID,
	).Scan(&etape.ID, &etape.DeclarationID, &etape.Etape,
		&etape.Commentaire, &etape.UserID, &etape.CreatedAt)
	if err != nil {
		jsonError(w, "Erreur création étape workflow", http.StatusInternalServerError)
		return
	}

	_, _ = h.DB.Exec(r.Context(),
		`UPDATE declarations SET statut=$1 WHERE id=$2`, toEtape, declID)

	jsonCreated(w, etape)
}
