package middleware

import "net/http"

// SecurityHeaders ajoute les en-têtes de sécurité HTTP recommandés (OWASP).
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		// Empêche le MIME-sniffing
		h.Set("X-Content-Type-Options", "nosniff")
		// Empêche l'intégration en iframe (clickjacking)
		h.Set("X-Frame-Options", "DENY")
		// Filtre XSS legacy (IE/Chrome ancien)
		h.Set("X-XSS-Protection", "1; mode=block")
		// Politique de référent
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		// Désactiver les API sensibles non utilisées
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		// HSTS - ignoré par les navigateurs sur HTTP, actif uniquement sur HTTPS
		h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		// CSP minimal pour une API JSON
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")

		next.ServeHTTP(w, r)
	})
}
