package middleware

import (
	"math"
	"net/http"
	"sync"
	"time"
)

type ipLimiter struct {
	mu         sync.Mutex
	tokens     float64
	maxTokens  float64
	refillRate float64 // tokens per second
	lastRefill time.Time
	lastAccess time.Time
}

func (l *ipLimiter) allow() bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(l.lastRefill).Seconds()
	l.tokens = math.Min(l.maxTokens, l.tokens+elapsed*l.refillRate)
	l.lastRefill = now
	l.lastAccess = now

	if l.tokens >= 1 {
		l.tokens--
		return true
	}
	return false
}

type rateLimitStore struct {
	mu       sync.Mutex
	limiters map[string]*ipLimiter
}

func newRateLimitStore() *rateLimitStore {
	s := &rateLimitStore{limiters: make(map[string]*ipLimiter)}
	go s.cleanup()
	return s
}

func (s *rateLimitStore) get(ip string, maxTokens, refillRate float64) *ipLimiter {
	s.mu.Lock()
	defer s.mu.Unlock()
	if l, ok := s.limiters[ip]; ok {
		return l
	}
	l := &ipLimiter{
		tokens:     maxTokens,
		maxTokens:  maxTokens,
		refillRate: refillRate,
		lastRefill: time.Now(),
		lastAccess: time.Now(),
	}
	s.limiters[ip] = l
	return l
}

// cleanup supprime les limiters inutilisés depuis 15 minutes.
func (s *rateLimitStore) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		s.mu.Lock()
		for ip, l := range s.limiters {
			l.mu.Lock()
			stale := time.Since(l.lastAccess) > 15*time.Minute
			l.mu.Unlock()
			if stale {
				delete(s.limiters, ip)
			}
		}
		s.mu.Unlock()
	}
}

// RateLimit retourne un middleware limitant les requêtes par IP.
// maxTokens = burst autorisé, refillPerSec = recharge par seconde.
func RateLimit(maxTokens float64, refillPerSec float64) func(http.Handler) http.Handler {
	store := newRateLimitStore()
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			// chi/middleware.RealIP aura déjà normalisé l'IP réelle
			if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
				ip = realIP
			}
			l := store.get(ip, maxTokens, refillPerSec)
			if !l.allow() {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", "60")
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"Trop de tentatives. Veuillez réessayer dans quelques instants."}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
