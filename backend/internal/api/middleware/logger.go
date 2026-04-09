package middleware

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	chimd "github.com/go-chi/chi/v5/middleware"
)

// JSONLogger remplace le middleware.Logger de chi par un logger JSON structuré.
func JSONLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := chimd.NewWrapResponseWriter(w, r.ProtoMajor)

		next.ServeHTTP(ww, r)

		entry := map[string]any{
			"time":    start.UTC().Format(time.RFC3339),
			"method":  r.Method,
			"path":    r.URL.Path,
			"status":  ww.Status(),
			"latency": time.Since(start).String(),
			"ip":      r.RemoteAddr,
			"bytes":   ww.BytesWritten(),
		}
		if reqID := chimd.GetReqID(r.Context()); reqID != "" {
			entry["request_id"] = reqID
		}
		json.NewEncoder(os.Stdout).Encode(entry) //nolint:errcheck
	})
}
