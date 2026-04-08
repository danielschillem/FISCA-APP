package api

import (
	"net/http"

	"github.com/fisca-app/backend/internal/api/handlers"
	mw "github.com/fisca-app/backend/internal/api/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
)

func NewRouter(db *pgxpool.Pool) http.Handler {
	r := chi.NewRouter()

	// Middlewares globaux
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*.vercel.app", "http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Handlers
	authH := handlers.NewAuthHandler(db)
	empH := handlers.NewEmployeeHandler(db)
	calcH := handlers.NewCalculHandler()
	declH := handlers.NewDeclarationHandler(db)
	compH := handlers.NewCompanyHandler(db)

	// Routes publiques
	r.Route("/api", func(r chi.Router) {
		r.Post("/auth/register", authH.Register)
		r.Post("/auth/login", authH.Login)
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"status":"ok"}`))
		})

		// Routes protégées
		r.Group(func(r chi.Router) {
			r.Use(mw.Authenticate)

			// Employés
			r.Get("/employees", empH.List)
			r.Post("/employees", empH.Create)
			r.Put("/employees/{id}", empH.Update)
			r.Delete("/employees/{id}", empH.Delete)

			// Calcul fiscal (stateless)
			r.Post("/calcul", calcH.Calcul)

			// Déclarations
			r.Get("/declarations", declH.List)
			r.Post("/declarations", declH.Create)
			r.Delete("/declarations/{id}", declH.Delete)

			// Entreprise
			r.Get("/company", compH.Get)
			r.Put("/company", compH.Update)
		})
	})

	return r
}
