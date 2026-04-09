package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type UserHandler struct {
	DB *pgxpool.Pool
}

func NewUserHandler(db *pgxpool.Pool) *UserHandler {
	return &UserHandler{DB: db}
}

// GET /api/me
func (h *UserHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var u models.User
	err := h.DB.QueryRow(r.Context(),
		`SELECT id, email, plan, created_at FROM users WHERE id=$1`, userID,
	).Scan(&u.ID, &u.Email, &u.Plan, &u.CreatedAt)
	if err != nil {
		jsonError(w, "Utilisateur introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, u)
}

// PUT /api/me
func (h *UserHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || !strings.Contains(req.Email, "@") || len(req.Email) > 254 {
		jsonError(w, "Adresse email invalide", http.StatusBadRequest)
		return
	}

	var u models.User
	err := h.DB.QueryRow(r.Context(),
		`UPDATE users SET email=$1 WHERE id=$2
		 RETURNING id, email, plan, created_at`,
		req.Email, userID,
	).Scan(&u.ID, &u.Email, &u.Plan, &u.CreatedAt)
	if err != nil {
		jsonError(w, "Email déjà utilisé ou utilisateur introuvable", http.StatusConflict)
		return
	}
	jsonOK(w, u)
}

// PUT /api/me/password
func (h *UserHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		Current string `json:"current_password"`
		New     string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if len(req.New) < 8 || len(req.New) > 128 {
		jsonError(w, "Nouveau mot de passe : 8 à 128 caractères requis", http.StatusBadRequest)
		return
	}

	var hash string
	err := h.DB.QueryRow(r.Context(),
		`SELECT password_hash FROM users WHERE id=$1`, userID).Scan(&hash)
	if err != nil {
		jsonError(w, "Utilisateur introuvable", http.StatusNotFound)
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Current)) != nil {
		jsonError(w, "Mot de passe actuel incorrect", http.StatusUnauthorized)
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.New), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "Erreur interne", http.StatusInternalServerError)
		return
	}
	h.DB.Exec(r.Context(), `UPDATE users SET password_hash=$1 WHERE id=$2`, string(newHash), userID)
	// Révoquer tous les refresh tokens existants
	h.DB.Exec(r.Context(), `UPDATE refresh_tokens SET revoked=TRUE WHERE user_id=$1`, userID)

	jsonOK(w, map[string]string{"message": "Mot de passe modifié avec succès."})
}
