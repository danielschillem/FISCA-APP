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
	"github.com/joho/godotenv"
)

func main() {
	// Charger .env en développement
	if err := godotenv.Load(); err != nil {
		log.Println("Pas de fichier .env, utilisation des variables d'environnement système")
	}

	// Connexion base de données
	database, err := db.Connect()
	if err != nil {
		log.Fatalf("Connexion DB échouée: %v", err)
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
