package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	UserIDKey   contextKey = "userID"
	RoleKey     contextKey = "userRole"
	UserTypeKey contextKey = "userType"
	OrgIDKey    contextKey = "orgID"
	OrgRoleKey  contextKey = "orgRole"
)

// Authenticate vérifie le JWT Bearer et injecte userID, role, userType, orgID, orgRole dans le contexte.
func Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			http.Error(w, `{"error":"token manquant"}`, http.StatusUnauthorized)
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")

		secret := []byte(os.Getenv("JWT_SECRET"))
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return secret, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, `{"error":"token invalide"}`, http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, `{"error":"claims invalides"}`, http.StatusUnauthorized)
			return
		}

		userID, ok := claims["sub"].(string)
		if !ok {
			http.Error(w, `{"error":"sub manquant"}`, http.StatusUnauthorized)
			return
		}

		role, _ := claims["role"].(string)
		if role == "" {
			role = "user"
		}
		userType, _ := claims["userType"].(string)
		if userType == "" {
			userType = "physique"
		}
		orgID, _ := claims["orgId"].(string)
		orgRole, _ := claims["orgRole"].(string)

		ctx := r.Context()
		ctx = context.WithValue(ctx, UserIDKey, userID)
		ctx = context.WithValue(ctx, RoleKey, role)
		ctx = context.WithValue(ctx, UserTypeKey, userType)
		ctx = context.WithValue(ctx, OrgIDKey, orgID)
		ctx = context.WithValue(ctx, OrgRoleKey, orgRole)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireSuperAdmin bloque les requêtes dont le role JWT n'est pas "super_admin".
func RequireSuperAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, _ := r.Context().Value(RoleKey).(string)
		if role != "super_admin" {
			http.Error(w, `{"error":"accès interdit - super admin requis"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireOrgAdmin bloque les requêtes dont org_role n'est pas "org_admin".
func RequireOrgAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		orgRole, _ := r.Context().Value(OrgRoleKey).(string)
		if orgRole != "org_admin" {
			http.Error(w, `{"error":"accès interdit - admin organisation requis"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// GetUserID extrait le userID du contexte.
func GetUserID(r *http.Request) string {
	v, _ := r.Context().Value(UserIDKey).(string)
	return v
}

// GetUserRole extrait le role du contexte.
func GetUserRole(r *http.Request) string {
	v, _ := r.Context().Value(RoleKey).(string)
	return v
}

// GetUserType extrait le user_type du contexte (physique|morale).
func GetUserType(r *http.Request) string {
	v, _ := r.Context().Value(UserTypeKey).(string)
	return v
}

// GetOrgID extrait l'org_id du contexte.
func GetOrgID(r *http.Request) string {
	v, _ := r.Context().Value(OrgIDKey).(string)
	return v
}

// GetOrgRole extrait l'org_role du contexte.
func GetOrgRole(r *http.Request) string {
	v, _ := r.Context().Value(OrgRoleKey).(string)
	return v
}
