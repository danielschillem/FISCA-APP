// Middleware CompanyContext : lit le header optionnel X-Company-ID et vérifie
// les droits d'accès selon le type d'utilisateur (physique ou morale).
// Si absent, utilise la première société accessible.
package middleware

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

const companyIDKey contextKey = "company_id"

// CompanyContext retourne un middleware qui résout le company_id actif.
// Il doit être appliqué APRÈS Authenticate.
func CompanyContext(db *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := GetUserID(r)
			if userID == "" {
				next.ServeHTTP(w, r)
				return
			}

			orgID := GetOrgID(r)
			orgRole := GetOrgRole(r)
			requestedID := r.Header.Get("X-Company-ID")
			var companyID string

			if orgID != "" {
				// ── Personne Morale ──────────────────────────────────────────────
				if requestedID != "" {
					if orgRole == "org_admin" {
						// org_admin accède à n'importe quelle société de l'org
						err := db.QueryRow(r.Context(),
							`SELECT id FROM companies WHERE id=$1 AND org_id=$2`,
							requestedID, orgID).Scan(&companyID)
						if err != nil {
							writeForbidden(w)
							return
						}
					} else {
						// Vérifier l'accès via org_company_access
						err := db.QueryRow(r.Context(),
							`SELECT c.id FROM companies c
							 JOIN org_company_access oca ON oca.company_id = c.id
							 WHERE c.id=$1 AND c.org_id=$2 AND oca.user_id=$3`,
							requestedID, orgID, userID).Scan(&companyID)
						if err != nil {
							writeForbidden(w)
							return
						}
					}
				} else {
					// Fallback : première société accessible
					var fallbackErr error
					if orgRole == "org_admin" {
						fallbackErr = db.QueryRow(r.Context(),
							`SELECT id FROM companies WHERE org_id=$1 ORDER BY nom LIMIT 1`,
							orgID).Scan(&companyID)
					} else {
						fallbackErr = db.QueryRow(r.Context(),
							`SELECT c.id FROM companies c
							 JOIN org_company_access oca ON oca.company_id = c.id
							 WHERE c.org_id=$1 AND oca.user_id=$2 ORDER BY c.nom LIMIT 1`,
							orgID, userID).Scan(&companyID)
					}
					_ = fallbackErr // companyID vide géré par les handlers (retourne 404)
				}
			} else {
				// ── Personne Physique ────────────────────────────────────────────
				if requestedID != "" {
					err := db.QueryRow(r.Context(),
						`SELECT id FROM companies WHERE id=$1 AND user_id=$2`,
						requestedID, userID).Scan(&companyID)
					if err != nil {
						writeForbidden(w)
						return
					}
				} else {
					_ = db.QueryRow(r.Context(),
						`SELECT id FROM companies WHERE user_id=$1 ORDER BY nom LIMIT 1`,
						userID).Scan(&companyID) // companyID vide géré par les handlers (retourne 404)
				}
			}

			ctx := context.WithValue(r.Context(), companyIDKey, companyID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetCompanyID récupère le company_id depuis le contexte de la requête.
func GetCompanyID(r *http.Request) string {
	v, _ := r.Context().Value(companyIDKey).(string)
	return v
}

func writeForbidden(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	w.Write([]byte(`{"error":"Société introuvable ou accès non autorisé"}`)) //nolint:errcheck
}
