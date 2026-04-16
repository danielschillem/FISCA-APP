package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	mw "github.com/fisca-app/backend/internal/api/middleware"
)

func TestSecurityHeaders_AllHeadersPresent(t *testing.T) {
	handler := mw.SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	expected := map[string]string{
		"X-Content-Type-Options":  "nosniff",
		"X-Frame-Options":         "DENY",
		"X-Xss-Protection":        "1; mode=block",
		"Referrer-Policy":         "strict-origin-when-cross-origin",
		"Permissions-Policy":      "camera=(), microphone=(), geolocation=()",
		"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
	}

	for header, want := range expected {
		got := rec.Header().Get(header)
		if got != want {
			t.Errorf("Header %q = %q, want %q", header, got, want)
		}
	}
}

func TestSecurityHeaders_STSPresent(t *testing.T) {
	handler := mw.SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	sts := rec.Header().Get("Strict-Transport-Security")
	if sts == "" {
		t.Error("Strict-Transport-Security header is missing")
	}
}

func TestSecurityHeaders_NextHandlerCalled(t *testing.T) {
	called := false
	handler := mw.SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Error("next handler was not called")
	}
	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNoContent)
	}
}
