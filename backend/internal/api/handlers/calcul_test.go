package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/fisca-app/backend/internal/api/handlers"
)

func newCalculHandler() *handlers.CalculHandler {
	return handlers.NewCalculHandler()
}

func TestCalculHandler_ValidRequest(t *testing.T) {
	body := `{
		"salaire_base": 95000,
		"anciennete": 4750,
		"heures_sup": 0,
		"logement": 20000,
		"transport": 15000,
		"fonction": 0,
		"charges": 0,
		"cotisation": "CNSS"
	}`

	req := httptest.NewRequest(http.MethodPost, "/api/calcul", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h := newCalculHandler()
	h.Calcul(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var result map[string]float64
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	brut_total, ok := result["brut_total"]
	if !ok {
		t.Fatal("response missing brut_total field")
	}
	if brut_total != 134750 {
		t.Errorf("brut_total = %v, want 134750", brut_total)
	}
	if salaireNet, ok := result["salaire_net"]; ok {
		if salaireNet > brut_total {
			t.Errorf("salaire_net (%v) should not exceed brut_total (%v)", salaireNet, brut_total)
		}
	}
}

func TestCalculHandler_InvalidJSON_Returns400(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/calcul", bytes.NewBufferString("not json"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h := newCalculHandler()
	h.Calcul(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestCalculHandler_EmptyBody_Returns400(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/calcul", bytes.NewBufferString(""))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h := newCalculHandler()
	h.Calcul(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("empty body: status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestCalculHandler_ZeroSalaire_ValidResponse(t *testing.T) {
	body := `{"salaire_base": 0, "cotisation": "CNSS"}`
	req := httptest.NewRequest(http.MethodPost, "/api/calcul", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h := newCalculHandler()
	h.Calcul(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("zero salaire: status = %d, want %d", rec.Code, http.StatusOK)
	}

	var result map[string]float64
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if iuts, ok := result["iuts_net"]; ok && iuts < 0 {
		t.Errorf("iuts_net should be >= 0, got %v", iuts)
	}
}

func TestCalculHandler_CARFO_Cotisation(t *testing.T) {
	body := `{"salaire_base": 200000, "anciennete": 10000, "cotisation": "CARFO"}`
	req := httptest.NewRequest(http.MethodPost, "/api/calcul", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h := newCalculHandler()
	h.Calcul(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("CARFO: status = %d, want %d", rec.Code, http.StatusOK)
	}

	var result map[string]float64
	json.NewDecoder(rec.Body).Decode(&result) //nolint:errcheck
	// CotSoc CARFO = (200000+10000) * 6% = 12600
	if cotSoc, ok := result["cotisation_sociale"]; ok {
		if cotSoc != 12600 {
			t.Errorf("cotisation_sociale CARFO = %v, want 12600", cotSoc)
		}
	}
}
