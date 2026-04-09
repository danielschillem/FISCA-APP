// Middleware CompanyContext : lit le header optionnel X-Company-ID et vérifie
// que la société appartient bien à l'utilisateur authentifié.
// Si absent, utilise la première société (comportement existant).
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

			requestedID := r.Header.Get("X-Company-ID")
			var companyID string

			if requestedID != "" {
				// Vérifier que cette société appartient à l'utilisateur
				err := db.QueryRow(r.Context(),
					`SELECT id FROM companies WHERE id=$1 AND user_id=$2`,
					requestedID, userID).Scan(&companyID)
				if err != nil {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusForbidden)
					w.Write([]byte(`{"error":"Société introuvable ou accès non autorisé"}`)) //nolint:errcheck
					return
				}
			} else {
				// Fallback : première société de l'utilisateur
				db.QueryRow(r.Context(),
					`SELECT id FROM companies WHERE user_id=$1 ORDER BY nom LIMIT 1`,
					userID).Scan(&companyID)
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
