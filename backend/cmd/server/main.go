package main

import (
"context"
"encoding/json"
"fmt"
"log"
"net/http"
"os"
"os/signal"
"sync"
"syscall"
"time"

"github.com/fisca-app/backend/internal/api"
"github.com/fisca-app/backend/internal/db"
"github.com/jackc/pgx/v5/pgxpool"
"github.com/joho/godotenv"
)

func main() {
if err := godotenv.Load(); err != nil {
log.Println("Pas de fichier .env, utilisation des variables d'environnement systeme")
}

port := os.Getenv("PORT")
if port == "" {
port = "8080"
}

// A02 OWASP : JWT_SECRET doit être présent et suffisamment long avant tout démarrage.
if secret := os.Getenv("JWT_SECRET"); len(secret) < 32 {
log.Fatal("[SECURITE] JWT_SECRET manquant ou trop court — minimum 32 caractères requis")
}

// Demarrage immediat du serveur HTTP - Render health check passe des maintenant
var (
handlerMu      sync.RWMutex
currentHandler http.Handler
)
currentHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
if r.URL.Path == "/api/health" {
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]any{"status": "ok", "db": "connecting"}) //nolint:errcheck
return
}
http.Error(w, `{"error":"service starting"}`, http.StatusServiceUnavailable)
})

srv := &http.Server{
Addr: fmt.Sprintf(":%s", port),
Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
handlerMu.RLock()
h := currentHandler
handlerMu.RUnlock()
h.ServeHTTP(w, r)
}),
ReadTimeout:  15 * time.Second,
WriteTimeout: 15 * time.Second,
IdleTimeout:  60 * time.Second,
}

go func() {
log.Printf("Serveur FISCA demarre sur :%s (connexion DB en cours...)", port)
if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
log.Fatalf("Erreur serveur: %v", err)
}
}()

// Connexion DB avec retry (Neon peut dormir sur free tier)
var database *pgxpool.Pool
var err error
for attempt := 1; attempt <= 5; attempt++ {
database, err = db.Connect()
if err == nil {
break
}
log.Printf("Tentative connexion DB %d/5 echouee: %v", attempt, err)
if attempt < 5 {
time.Sleep(time.Duration(attempt*2) * time.Second)
}
}
if err != nil {
log.Fatalf("Connexion DB echouee apres 5 tentatives: %v", err)
}
defer database.Close()

if err := db.RunMigrations(database); err != nil {
log.Fatalf("Migration DB echouee: %v", err)
}

// Basculement vers le vrai router avec DB
handlerMu.Lock()
currentHandler = api.NewRouter(database)
handlerMu.Unlock()
log.Printf("Serveur FISCA pret sur :%s", port)

quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
if err := srv.Shutdown(ctx); err != nil {
log.Fatalf("Arret force: %v", err)
}
}