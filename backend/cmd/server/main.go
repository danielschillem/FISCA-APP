package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/fisca-app/backend/internal/api"
	"github.com/fisca-app/backend/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	// Charger .env en développement
	if err := godotenv.Load(); err != nil {
		log.Println("Pas de fichier .env, utilisation des variables d'environnement système")
	}

	// Connexion base de données avec retry (utile au démarrage sur Render)
	var database *pgxpool.Pool
	var err error
	for attempt := 1; attempt <= 5; attempt++ {
		database, err = db.Connect()
		if err == nil {
			break
		}
		log.Printf("Tentative connexion DB %d/5 échouée: %v", attempt, err)
		if attempt < 5 {
			time.Sleep(time.Duration(attempt*2) * time.Second)
		}
	}
	if err != nil {
		log.Fatalf("Connexion DB échouée après 5 tentatives: %v", err)
	}
	defer database.Close()

	// Migrations
	if err := db.RunMigrations(database); err != nil {
		log.Fatalf("Migration DB échouée: %v", err)
	}

	// Router
	router := api.NewRouter(database)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Démarrage avec graceful shutdown
	go func() {
		log.Printf("Serveur FISCA démarré sur :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Erreur serveur: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Arrêt forcé: %v", err)
	}
	log.Println("Serveur arrêté proprement")
}
