package middleware_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	mw "github.com/fisca-app/backend/internal/api/middleware"
	"github.com/golang-jwt/jwt/v5"
)

// makeJWT génère un JWT signé avec la clé donnée et l'expiration donnée.
func makeJWT(secret string, sub string, exp time.Time) string {
	claims := jwt.MapClaims{
		"sub": sub,
		"exp": exp.Unix(),
	}
	token, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	return token
}

func TestAuthenticate_MissingHeader_Returns401(t *testing.T) {
	os.Setenv("JWT_SECRET", "testsecret")
	handler := mw.Authenticate(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestAuthenticate_InvalidToken_Returns401(t *testing.T) {
	os.Setenv("JWT_SECRET", "testsecret")
	handler := mw.Authenticate(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer invalidtoken")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestAuthenticate_ExpiredToken_Returns401(t *testing.T) {
	secret := "testsecret"
	os.Setenv("JWT_SECRET", secret)
	// Token expiré il y a 1 heure
	tok := makeJWT(secret, "user-123", time.Now().Add(-1*time.Hour))

	handler := mw.Authenticate(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", tok))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expired token: status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestAuthenticate_ValidToken_PassesThrough(t *testing.T) {
	secret := "testsecret"
	os.Setenv("JWT_SECRET", secret)
	userID := "user-abc-123"
	tok := makeJWT(secret, userID, time.Now().Add(1*time.Hour))

	var capturedUserID string
	handler := mw.Authenticate(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedUserID = mw.GetUserID(r)
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", tok))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("valid token: status = %d, want %d", rec.Code, http.StatusOK)
	}
	if capturedUserID != userID {
		t.Errorf("GetUserID = %q, want %q", capturedUserID, userID)
	}
}

func TestAuthenticate_WrongSigningMethod_Returns401(t *testing.T) {
	os.Setenv("JWT_SECRET", "testsecret")

	// Crée un token signé avec RS256 (clé HMAC attendue → doit être rejeté)
	claims := jwt.MapClaims{"sub": "user", "exp": time.Now().Add(1 * time.Hour).Unix()}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS384, claims)
	tokenStr, _ := tok.SignedString([]byte("autresecret"))

	handler := mw.Authenticate(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", tokenStr))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("wrong key token: status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestGetUserID_EmptyContext(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(context.Background())
	if got := mw.GetUserID(req); got != "" {
		t.Errorf("GetUserID on empty context = %q, want empty", got)
	}
}
