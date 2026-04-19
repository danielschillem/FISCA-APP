package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/fisca-app/backend/internal/mailer"
	"github.com/fisca-app/backend/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB *pgxpool.Pool
}

func NewAuthHandler(db *pgxpool.Pool) *AuthHandler {
	return &AuthHandler{DB: db}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || !strings.Contains(req.Email, "@") || len(req.Email) > 254 {
		jsonError(w, "Adresse email invalide", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 8 || len(req.Password) > 128 {
		jsonError(w, "Mot de passe : 8 à 128 caractères requis", http.StatusBadRequest)
		return
	}
	if len(strings.TrimSpace(req.Nom)) == 0 || len(req.Nom) > 100 {
		jsonError(w, "Nom requis (max 100 caractères)", http.StatusBadRequest)
		return
	}

	// Normaliser user_type et plan (rétro-compat si champs absents)
	if req.UserType == "" {
		req.UserType = "physique"
	}
	if req.Plan == "" {
		req.Plan = "physique_starter"
	}
	// Valider que le plan correspond au type
	planTypes := map[string]string{
		"physique_starter": "physique",
		"physique_pro":     "physique",
		"moral_team":       "morale",
		"moral_enterprise": "morale",
		// Rétro-compat avec anciens plans
		"starter":    "physique",
		"pro":        "physique",
		"enterprise": "morale",
	}
	if pt, ok := planTypes[req.Plan]; !ok || pt != req.UserType {
		jsonError(w, "Plan incompatible avec le type de compte", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "Erreur interne", http.StatusInternalServerError)
		return
	}

	if req.UserType == "physique" {
		// -- Personne Physique : un compte solo ---------------------------------
		var user models.User
		err = h.DB.QueryRow(r.Context(),
			`INSERT INTO users (email, password_hash, plan, role, user_type, is_active)
			 VALUES ($1, $2, $3, 'user', 'physique', TRUE)
			 RETURNING id, email, plan, role, user_type, org_id, org_role, is_active, created_at`,
			req.Email, string(hash), req.Plan,
		).Scan(&user.ID, &user.Email, &user.Plan, &user.Role, &user.UserType,
			&user.OrgID, &user.OrgRole, &user.IsActive, &user.CreatedAt)
		if err != nil {
			jsonError(w, "Email déjà utilisé", http.StatusConflict)
			return
		}
		// Créer une société par défaut
		h.DB.Exec(r.Context(),
			`INSERT INTO companies (user_id, nom) VALUES ($1, $2)`,
			user.ID, req.Nom,
		)
		token, err := generateToken(user)
		if err != nil {
			jsonError(w, "Erreur génération token", http.StatusInternalServerError)
			return
		}
		refreshToken, _ := h.storeRefreshToken(r.Context(), user.ID)
		go mailer.SendWelcome(user.Email, req.Nom) //nolint:errcheck
		jsonOK(w, models.AuthResponse{Token: token, RefreshToken: refreshToken, User: user})
		return
	}

	// -- Personne Morale : organisation + admin interne -------------------------
	maxUsers, maxCompanies, maxEmployees := planLimits(req.Plan)

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		jsonError(w, "Erreur interne", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context()) //nolint:errcheck

	// 1. Créer l'utilisateur admin interne
	var userID string
	err = tx.QueryRow(r.Context(),
		`INSERT INTO users (email, password_hash, plan, role, user_type, is_active)
		 VALUES ($1, $2, $3, 'user', 'morale', TRUE)
		 RETURNING id`,
		req.Email, string(hash), req.Plan,
	).Scan(&userID)
	if err != nil {
		if isPgDuplicate(err) {
			jsonError(w, "Email déjà utilisé", http.StatusConflict)
		} else {
			jsonError(w, "Erreur interne", http.StatusInternalServerError)
		}
		return
	}

	// 2. Créer l'organisation
	var orgID string
	err = tx.QueryRow(r.Context(),
		`INSERT INTO organizations (nom, plan, max_users, max_companies, max_employees, owner_id)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id`,
		req.Nom, req.Plan, maxUsers, maxCompanies, maxEmployees, userID,
	).Scan(&orgID)
	if err != nil {
		jsonError(w, "Erreur interne", http.StatusInternalServerError)
		return
	}

	// 3. Lier l'utilisateur à l'organisation comme org_admin
	_, err = tx.Exec(r.Context(),
		`UPDATE users SET org_id=$1, org_role='org_admin' WHERE id=$2`,
		orgID, userID,
	)
	if err != nil {
		jsonError(w, "Erreur interne", http.StatusInternalServerError)
		return
	}

	// 4. Créer la première société liée à l'org
	var companyID string
	err = tx.QueryRow(r.Context(),
		`INSERT INTO companies (user_id, nom, org_id) VALUES ($1, $2, $3) RETURNING id`,
		userID, req.Nom, orgID,
	).Scan(&companyID)
	if err != nil {
		jsonError(w, "Erreur interne", http.StatusInternalServerError)
		return
	}

	// 5. Donner accès à la société au fondateur
	_, err = tx.Exec(r.Context(),
		`INSERT INTO org_company_access (user_id, company_id, granted_by) VALUES ($1,$2,$1)`,
		userID, companyID,
	)
	if err != nil {
		jsonError(w, "Erreur interne", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		jsonError(w, "Erreur interne", http.StatusInternalServerError)
		return
	}

	// Charger l'utilisateur complet
	var user models.User
	h.DB.QueryRow(r.Context(),
		`SELECT id, email, plan, role, user_type, org_id, org_role, is_active, created_at
		 FROM users WHERE id=$1`, userID,
	).Scan(&user.ID, &user.Email, &user.Plan, &user.Role, &user.UserType,
		&user.OrgID, &user.OrgRole, &user.IsActive, &user.CreatedAt)

	token, err := generateToken(user)
	if err != nil {
		jsonError(w, "Erreur génération token", http.StatusInternalServerError)
		return
	}
	refreshToken, _ := h.storeRefreshToken(r.Context(), user.ID)
	go mailer.SendWelcome(user.Email, req.Nom) //nolint:errcheck
	jsonOK(w, models.AuthResponse{Token: token, RefreshToken: refreshToken, User: user})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	// A07 OWASP : normaliser l'email exactement comme à l'inscription pour éviter
	// des comptes fantômes et des incohérences de casse.
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || !strings.Contains(req.Email, "@") || len(req.Email) > 254 {
		jsonError(w, "Identifiants invalides", http.StatusUnauthorized)
		return
	}

	var user models.User
	err := h.DB.QueryRow(r.Context(),
		`SELECT id, email, password_hash, plan, role, user_type, org_id, org_role, is_active, created_at
		 FROM users WHERE email=$1`,
		req.Email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Plan, &user.Role,
		&user.UserType, &user.OrgID, &user.OrgRole, &user.IsActive, &user.CreatedAt)
	if err != nil {
		jsonError(w, "Identifiants invalides", http.StatusUnauthorized)
		return
	}

	if !user.IsActive {
		jsonError(w, "Compte suspendu - contactez l'administrateur", http.StatusForbidden)
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		jsonError(w, "Identifiants invalides", http.StatusUnauthorized)
		return
	}

	token, err := generateToken(user)
	if err != nil {
		jsonError(w, "Erreur génération token", http.StatusInternalServerError)
		return
	}
	refreshToken, _ := h.storeRefreshToken(r.Context(), user.ID)

	jsonOK(w, models.AuthResponse{Token: token, RefreshToken: refreshToken, User: user})
}

func generateToken(u models.User) (string, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))
	claims := jwt.MapClaims{
		"sub":      u.ID,
		"role":     u.Role,
		"userType": u.UserType,
		"iat":      time.Now().Unix(),
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	}
	if u.OrgID != nil {
		claims["orgId"] = *u.OrgID
	}
	if u.OrgRole != nil {
		claims["orgRole"] = *u.OrgRole
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

// storeRefreshToken génère et stocke un refresh token opaque en DB (90 jours).
func (h *AuthHandler) storeRefreshToken(ctx context.Context, userID string) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := hex.EncodeToString(b)
	expires := time.Now().Add(90 * 24 * time.Hour)
	_, err := h.DB.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)`,
		userID, token, expires,
	)
	return token, err
}

// POST /api/auth/refresh - échange un refresh token valide contre de nouveaux tokens.
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		jsonError(w, "refresh_token requis", http.StatusBadRequest)
		return
	}

	var userID string
	var expires time.Time
	var revoked bool
	err := h.DB.QueryRow(r.Context(),
		`SELECT user_id, expires_at, revoked FROM refresh_tokens WHERE token=$1`,
		req.RefreshToken,
	).Scan(&userID, &expires, &revoked)
	if err != nil || revoked || time.Now().After(expires) {
		jsonError(w, "Refresh token invalide ou expiré", http.StatusUnauthorized)
		return
	}

	// Rotation : invalider l'ancien token
	h.DB.Exec(r.Context(), `UPDATE refresh_tokens SET revoked=TRUE WHERE token=$1`, req.RefreshToken)

	var user models.User
	h.DB.QueryRow(r.Context(),
		`SELECT id, email, plan, role, user_type, org_id, org_role, is_active, created_at FROM users WHERE id=$1`, userID,
	).Scan(&user.ID, &user.Email, &user.Plan, &user.Role, &user.UserType,
		&user.OrgID, &user.OrgRole, &user.IsActive, &user.CreatedAt)

	if !user.IsActive {
		jsonError(w, "Compte suspendu", http.StatusForbidden)
		return
	}

	token, err := generateToken(user)
	if err != nil {
		jsonError(w, "Erreur génération token", http.StatusInternalServerError)
		return
	}
	newRefresh, _ := h.storeRefreshToken(r.Context(), userID)
	jsonOK(w, models.AuthResponse{Token: token, RefreshToken: newRefresh, User: user})
}

// POST /api/auth/logout - révoque le refresh token.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		// Pas d'erreur fatale - le client peut déjà avoir supprimé le token
		w.WriteHeader(http.StatusNoContent)
		return
	}
	h.DB.Exec(r.Context(), `UPDATE refresh_tokens SET revoked=TRUE WHERE token=$1`, req.RefreshToken)
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/auth/forgot-password
func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" {
		jsonError(w, "Email requis", http.StatusBadRequest)
		return
	}

	// Chercher l'utilisateur (ne pas révéler son existence en cas d'erreur)
	var userID string
	err := h.DB.QueryRow(r.Context(),
		`SELECT id FROM users WHERE email=$1`, req.Email,
	).Scan(&userID)

	// Toujours répondre la même chose pour éviter l'énumération d'emails
	msg := map[string]string{"message": "Si votre email est enregistré, un lien de réinitialisation vous a été envoyé."}
	if err != nil {
		jsonOK(w, msg)
		return
	}

	// Générer un token sécurisé
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		jsonError(w, "Erreur interne", http.StatusInternalServerError)
		return
	}
	token := hex.EncodeToString(b)
	expires := time.Now().Add(1 * time.Hour)

	// Invalider les anciens tokens et stocker le nouveau
	h.DB.Exec(r.Context(), `UPDATE password_reset_tokens SET used=TRUE WHERE user_id=$1`, userID)
	h.DB.Exec(r.Context(),
		`INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)`,
		userID, token, expires,
	)

	// Envoyer l'email (fallback log si SMTP non configuré)
	if err := mailer.SendResetPassword(req.Email, token); err != nil {
		log.Printf("[MAILER] Erreur envoi reset pour %s: %v", req.Email, err)
	}

	jsonOK(w, msg)
}

// POST /api/auth/reset-password
func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if req.Token == "" || len(req.Password) < 8 {
		jsonError(w, "Token et mot de passe (≥ 8 caractères) requis", http.StatusBadRequest)
		return
	}

	var userID string
	var expires time.Time
	var used bool
	err := h.DB.QueryRow(r.Context(),
		`SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token=$1`,
		req.Token,
	).Scan(&userID, &expires, &used)
	if err != nil || used || time.Now().After(expires) {
		jsonError(w, "Token invalide ou expiré", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "Erreur interne", http.StatusInternalServerError)
		return
	}

	h.DB.Exec(r.Context(), `UPDATE users SET password_hash=$1 WHERE id=$2`, string(hash), userID)
	h.DB.Exec(r.Context(), `UPDATE password_reset_tokens SET used=TRUE WHERE token=$1`, req.Token)

	jsonOK(w, map[string]string{"message": "Mot de passe réinitialisé avec succès."})
}

// --- HELPERS --------------------------------------------------

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(v)
}

func jsonCreated(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(v)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// planLimits retourne les limites d'un plan : (maxUsers, maxCompanies, maxEmployees).
// -1 = illimité (sur devis pour moral_enterprise).
func planLimits(plan string) (int, int, int) {
	switch plan {
	case "physique_starter", "starter":
		return 1, 1, 3
	case "physique_pro", "pro":
		return 1, 1, 10
	case "moral_team":
		return 5, 2, 200
	case "moral_enterprise", "enterprise":
		return -1, -1, -1
	default:
		return 1, 1, 3
	}
}

// isPgDuplicate vérifie si l'erreur pgx est une violation de contrainte unique (code 23505).
func isPgDuplicate(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate key")
}

// planFromContext - référence utilisée par pgx.Tx (évite "imported and not used")
var _ = pgx.ErrNoRows
