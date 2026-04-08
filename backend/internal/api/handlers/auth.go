package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/fisca-app/backend/internal/models"
	"github.com/golang-jwt/jwt/v5"
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
	if req.Email == "" || len(req.Password) < 8 {
		jsonError(w, "Email requis et mot de passe ≥ 8 caractères", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "Erreur interne", http.StatusInternalServerError)
		return
	}

	var user models.User
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2)
		 RETURNING id, email, plan, created_at`,
		req.Email, string(hash),
	).Scan(&user.ID, &user.Email, &user.Plan, &user.CreatedAt)
	if err != nil {
		jsonError(w, "Email déjà utilisé", http.StatusConflict)
		return
	}

	// Créer une entreprise par défaut
	h.DB.Exec(r.Context(),
		`INSERT INTO companies (user_id, nom) VALUES ($1, $2)`,
		user.ID, req.Nom,
	)

	token, err := generateToken(user.ID)
	if err != nil {
		jsonError(w, "Erreur génération token", http.StatusInternalServerError)
		return
	}

	jsonOK(w, models.AuthResponse{Token: token, User: user})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}

	var user models.User
	err := h.DB.QueryRow(r.Context(),
		`SELECT id, email, password_hash, plan, created_at FROM users WHERE email=$1`,
		req.Email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Plan, &user.CreatedAt)
	if err != nil {
		jsonError(w, "Identifiants invalides", http.StatusUnauthorized)
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		jsonError(w, "Identifiants invalides", http.StatusUnauthorized)
		return
	}

	token, err := generateToken(user.ID)
	if err != nil {
		jsonError(w, "Erreur génération token", http.StatusInternalServerError)
		return
	}

	jsonOK(w, models.AuthResponse{Token: token, User: user})
}

func generateToken(userID string) (string, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))
	claims := jwt.MapClaims{
		"sub": userID,
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(30 * 24 * time.Hour).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

// ─── HELPERS ──────────────────────────────────────────────────

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
