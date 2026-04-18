// Tests smoke HTTP - router FISCA-APP (sans DB réelle)
package api_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/fisca-app/backend/internal/api"
	"github.com/jackc/pgx/v5/pgxpool"
)

// newDisconnectedPool crée un pool avec un DSN invalide.
// pgxpool.New ne tente pas de connexion immédiatement ; la pool est utilisable
// comme argument sans provoquer de panique.
func newDisconnectedPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	pool, err := pgxpool.New(context.Background(), "postgres://invalid:x@127.0.0.1:9999/invalid")
	if err != nil {
		t.Skipf("pgxpool.New a échoué (skip) : %v", err)
	}
	return pool
}

func TestHealthEndpoint_Returns200(t *testing.T) {
	pool := newDisconnectedPool(t)
	defer pool.Close()

	router := api.NewRouter(pool)
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// /api/health renvoie toujours 200 même si la DB est injoignable
	if rr.Code != http.StatusOK {
		t.Errorf("GET /api/health = %d, want %d", rr.Code, http.StatusOK)
	}
}

func TestEmployeesEndpoint_NoAuth_Returns401(t *testing.T) {
	pool := newDisconnectedPool(t)
	defer pool.Close()

	router := api.NewRouter(pool)
	req := httptest.NewRequest(http.MethodGet, "/api/employees", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("GET /api/employees (sans auth) = %d, want 401", rr.Code)
	}
}

func TestBilanEndpoint_NoAuth_Returns401(t *testing.T) {
	pool := newDisconnectedPool(t)
	defer pool.Close()

	router := api.NewRouter(pool)
	req := httptest.NewRequest(http.MethodGet, "/api/bilan", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("GET /api/bilan (sans auth) = %d, want 401", rr.Code)
	}
}

func TestNotificationsEndpoint_NoAuth_Returns401(t *testing.T) {
	pool := newDisconnectedPool(t)
	defer pool.Close()

	router := api.NewRouter(pool)
	req := httptest.NewRequest(http.MethodGet, "/api/notifications", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("GET /api/notifications (sans auth) = %d, want 401", rr.Code)
	}
}
