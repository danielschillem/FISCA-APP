package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NotificationHandler struct {
	DB *pgxpool.Pool
}

func NewNotificationHandler(db *pgxpool.Pool) *NotificationHandler {
	return &NotificationHandler{DB: db}
}

type Notification struct {
	ID      string `json:"id"`
	Type    string `json:"type"`   // "retard" | "manquant" | "approuve" | "rejete"
	Niveau  string `json:"niveau"` // "warning" | "error" | "info" | "success"
	Titre   string `json:"titre"`
	Message string `json:"message"`
	Periode string `json:"periode,omitempty"`
	Ref     string `json:"ref,omitempty"`
	Lien    string `json:"lien,omitempty"`
	Lu      bool   `json:"lu"`
}

// GET /api/notifications
func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var companyID string
	err := h.DB.QueryRow(r.Context(),
		`SELECT id FROM companies WHERE user_id=$1 LIMIT 1`, userID).Scan(&companyID)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}

	now := time.Now()
	var notifications []Notification

	// 1. Déclarations en retard (passé le 20 du mois suivant, non approuvées)
	rows, err := h.DB.Query(r.Context(),
		`SELECT id, COALESCE(ref,''), periode, mois, annee, statut
		 FROM declarations
		 WHERE company_id=$1
		   AND statut NOT IN ('approuve','ok')
		 ORDER BY annee DESC, mois DESC`,
		companyID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, ref, periode, statut string
			var mois, annee int
			if rows.Scan(&id, &ref, &periode, &mois, &annee, &statut) != nil {
				continue
			}
			echeance := time.Date(annee, time.Month(mois+1), 20, 0, 0, 0, 0, time.UTC)
			joursRestants := int(echeance.Sub(now).Hours() / 24)

			if now.After(echeance) {
				notifications = append(notifications, Notification{
					ID:      fmt.Sprintf("retard-%s", id),
					Type:    "retard",
					Niveau:  "error",
					Titre:   fmt.Sprintf("Déclaration en retard - %s", periode),
					Message: fmt.Sprintf("La déclaration IUTS/TPA de %s n'a pas été validée. Échéance dépassée depuis le 20/%02d/%d.", periode, mois+1, annee),
					Periode: periode,
					Ref:     ref,
					Lien:    fmt.Sprintf("/dashboard/historique/%s", id),
				})
			} else if joursRestants <= 5 {
				notifications = append(notifications, Notification{
					ID:      fmt.Sprintf("echeance-%s", id),
					Type:    "echeance",
					Niveau:  "warning",
					Titre:   fmt.Sprintf("Échéance proche - %s", periode),
					Message: fmt.Sprintf("Il reste %d jour(s) pour valider la déclaration de %s (échéance le 20/%02d/%d).", joursRestants, periode, mois+1, annee),
					Periode: periode,
					Ref:     ref,
					Lien:    fmt.Sprintf("/dashboard/historique/%s", id),
				})
			}
		}
	}

	// 2. Déclarations récemment approuvées (< 7 jours)
	rows2, err2 := h.DB.Query(r.Context(),
		`SELECT id, COALESCE(ref,''), periode
		 FROM declarations
		 WHERE company_id=$1
		   AND statut='approuve'
		   AND created_at > NOW() - INTERVAL '7 days'
		 ORDER BY created_at DESC LIMIT 3`,
		companyID)
	if err2 == nil {
		defer rows2.Close()
		for rows2.Next() {
			var id, ref, periode string
			if rows2.Scan(&id, &ref, &periode) != nil {
				continue
			}
			notifications = append(notifications, Notification{
				ID:      fmt.Sprintf("approuve-%s", id),
				Type:    "approuve",
				Niveau:  "success",
				Titre:   fmt.Sprintf("Déclaration approuvée - %s", periode),
				Message: fmt.Sprintf("Votre déclaration IUTS/TPA de %s a été approuvée.", periode),
				Periode: periode,
				Ref:     ref,
				Lien:    fmt.Sprintf("/dashboard/historique/%s", id),
			})
		}
	}

	// 3. Déclarations récemment rejetées (< 14 jours)
	rows3, err3 := h.DB.Query(r.Context(),
		`SELECT d.id, COALESCE(d.ref,''), d.periode
		 FROM declarations d
		 WHERE d.company_id=$1
		   AND d.statut='rejete'
		   AND EXISTS (
		     SELECT 1 FROM workflow_etapes w
		     WHERE w.declaration_id=d.id AND w.etape='rejete'
		     AND w.created_at > NOW() - INTERVAL '14 days'
		   )
		 ORDER BY d.created_at DESC LIMIT 3`,
		companyID)
	if err3 == nil {
		defer rows3.Close()
		for rows3.Next() {
			var id, ref, periode string
			if rows3.Scan(&id, &ref, &periode) != nil {
				continue
			}
			notifications = append(notifications, Notification{
				ID:      fmt.Sprintf("rejete-%s", id),
				Type:    "rejete",
				Niveau:  "error",
				Titre:   fmt.Sprintf("Déclaration rejetée - %s", periode),
				Message: fmt.Sprintf("Votre déclaration de %s a été rejetée. Veuillez la corriger et la re-soumettre.", periode),
				Periode: periode,
				Ref:     ref,
				Lien:    fmt.Sprintf("/dashboard/historique/%s", id),
			})
		}
	}

	// 4. Mois courant sans déclaration
	moisCourant := int(now.Month())
	anneeCourante := now.Year()
	// Vérifier seulement après le 5 du mois (laisser le temps de saisir)
	if now.Day() >= 5 {
		var count int
		h.DB.QueryRow(r.Context(),
			`SELECT COUNT(*) FROM declarations WHERE company_id=$1 AND mois=$2 AND annee=$3`,
			companyID, moisCourant, anneeCourante).Scan(&count)
		if count == 0 {
			var nbEmp int
			h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM employees WHERE company_id=$1`, companyID).Scan(&nbEmp)
			if nbEmp > 0 {
				moisNoms := map[int]string{
					1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
					5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
					9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
				}
				notifications = append(notifications, Notification{
					ID:      fmt.Sprintf("manquant-%d-%d", anneeCourante, moisCourant),
					Type:    "manquant",
					Niveau:  "warning",
					Titre:   fmt.Sprintf("Déclaration %s non générée", moisNoms[moisCourant]),
					Message: fmt.Sprintf("Aucune déclaration IUTS/TPA n'a été générée pour %s %d.", moisNoms[moisCourant], anneeCourante),
					Lien:    "/dashboard/saisie",
				})
			}
		}
	}

	if notifications == nil {
		notifications = []Notification{}
	}

	// Marquer les notifications déjà lues
	readRows, err := h.DB.Query(r.Context(),
		`SELECT notif_id FROM user_notif_reads WHERE user_id=$1`, userID)
	if err == nil {
		defer readRows.Close()
		readSet := map[string]bool{}
		for readRows.Next() {
			var nid string
			if readRows.Scan(&nid) == nil {
				readSet[nid] = true
			}
		}
		for i := range notifications {
			notifications[i].Lu = readSet[notifications[i].ID]
		}
	}

	jsonOK(w, notifications)
}

// PUT /api/notifications/:id/read
func (h *NotificationHandler) ReadOne(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	notifID := chi.URLParam(r, "id")
	if notifID == "" {
		jsonError(w, "ID manquant", http.StatusBadRequest)
		return
	}
	h.DB.Exec(r.Context(), //nolint:errcheck
		`INSERT INTO user_notif_reads(user_id, notif_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
		userID, notifID)
	w.WriteHeader(http.StatusNoContent)
}

// PUT /api/notifications/read-all
func (h *NotificationHandler) ReadAll(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var body struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.IDs) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	for _, id := range body.IDs {
		h.DB.Exec(r.Context(), //nolint:errcheck
			`INSERT INTO user_notif_reads(user_id, notif_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
			userID, id)
	}
	w.WriteHeader(http.StatusNoContent)
}
