package api

import (
	"net/http"
	"os"
	"strings"

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
	r.Use(middleware.RequestID)
	r.Use(mw.JSONLogger)
	r.Use(mw.SecurityHeaders)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(middleware.RequestSize(1 << 20)) // 1 MB max body
	// CORS — origines autorisées
	allowedOrigins := []string{"https://*.vercel.app", "http://localhost:3000"}
	if extra := os.Getenv("ALLOWED_ORIGIN"); extra != "" {
		// Supporte plusieurs origines séparées par des virgules
		for _, o := range strings.Split(extra, ",") {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				allowedOrigins = append(allowedOrigins, trimmed)
			}
		}
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Company-ID"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Handlers
	authH := handlers.NewAuthHandler(db)
	empH := handlers.NewEmployeeHandler(db)
	calcH := handlers.NewCalculHandler()
	declH := handlers.NewDeclarationHandler(db)
	compH := handlers.NewCompanyHandler(db)
	companiesH := handlers.NewCompaniesHandler(db)
	bulletinH := handlers.NewBulletinHandler(db)
	simH := handlers.NewSimulationHandler(db)
	tvaH := handlers.NewTVAHandler(db)
	wfH := handlers.NewWorkflowHandler(db)
	userH := handlers.NewUserHandler(db)
	dashH := handlers.NewDashboardHandler(db)
	assistantH := handlers.NewAssistantHandler(db)
	notifH := handlers.NewNotificationHandler(db)
	retenueH := handlers.NewRetenueHandler(db)
	cnssH := handlers.NewCNSSHandler(db)
	histoH := handlers.NewHistoriqueFiscalHandler(db)
	exerciceH := handlers.NewExerciceHandler(db)

	// Routes publiques
	r.Route("/api", func(r chi.Router) {
		// Rate limiting sur les routes d'authentification (5 burst, 1 req/10s)
		authRateLimit := mw.RateLimit(5, 0.1)

		r.With(authRateLimit).Post("/auth/register", authH.Register)
		r.With(authRateLimit).Post("/auth/login", authH.Login)
		r.With(authRateLimit).Post("/auth/forgot-password", authH.ForgotPassword)
		r.With(authRateLimit).Post("/auth/reset-password", authH.ResetPassword)
		r.Post("/auth/refresh", authH.Refresh)
		r.Post("/auth/logout", authH.Logout)
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"status":"ok"}`)) //nolint:errcheck
		})

		// Routes protégées
		r.Group(func(r chi.Router) {
			r.Use(mw.Authenticate)
			r.Use(mw.CompanyContext(db))

			// Profil utilisateur
			r.Get("/me", userH.Me)
			r.Put("/me", userH.UpdateMe)
			r.Put("/me/password", userH.ChangePassword)

			// Dashboard KPIs
			r.Get("/dashboard", dashH.Get)

			// Notifications
			r.Get("/notifications", notifH.List)

			// Assistant IA [Plan: Pro+]
			r.Post("/assistant", assistantH.Chat)

			// Employés
			r.Get("/employees", empH.List)
			r.Post("/employees", empH.Create)
			r.Put("/employees/{id}", empH.Update)
			r.Delete("/employees/{id}", empH.Delete)

			// Calcul fiscal (stateless)
			r.Post("/calcul", calcH.Calcul)

			// Déclarations + workflow
			r.Get("/declarations", declH.List)
			r.Post("/declarations", declH.Create)
			r.Get("/declarations/{id}", declH.Get)
			r.Get("/declarations/{id}/export", declH.Export)
			r.Delete("/declarations/{id}", declH.Delete)
			r.Get("/declarations/{id}/workflow", wfH.History)
			r.Post("/declarations/{id}/soumettre", wfH.Soumettre)
			r.Post("/declarations/{id}/approuver", wfH.Approuver)
			r.Post("/declarations/{id}/rejeter", wfH.Rejeter)

			// Entreprise (compat)
			r.Get("/company", compH.Get)
			r.Put("/company", compH.Update)

			// Multi-sociétés
			r.Get("/companies", companiesH.List)
			r.Post("/companies", companiesH.Create)
			r.Put("/companies/{id}", companiesH.Update)
			r.Delete("/companies/{id}", companiesH.Delete)

			// Bulletins de paie [Plan: Pro+]
			r.Get("/bulletins", bulletinH.List)
			r.Post("/bulletins/generate", bulletinH.Generate)
			r.Get("/bulletins/{id}", bulletinH.Get)
			r.Get("/bulletins/{id}/export", bulletinH.Export)
			r.Delete("/bulletins/{id}", bulletinH.Delete)

			// Simulateur fiscal (historique)
			r.Get("/simulations", simH.List)
			r.Post("/simulations", simH.Create)
			r.Get("/simulations/{id}", simH.Get)
			r.Delete("/simulations/{id}", simH.Delete)

			// Module TVA [Plan: Pro+]
			r.Get("/tva", tvaH.List)
			r.Post("/tva", tvaH.Create)
			r.Get("/tva/{id}", tvaH.Get)
			r.Put("/tva/{id}", tvaH.Update)
			r.Delete("/tva/{id}", tvaH.Delete)
			r.Get("/tva/{id}/export", tvaH.Export)
			r.Post("/tva/{id}/lignes", tvaH.AddLigne)
			r.Delete("/tva/{id}/lignes/{lid}", tvaH.DeleteLigne)

			// Retenue à la source [Plan: Enterprise]
			r.Get("/retenues/taux", retenueH.Taux)
			r.Get("/retenues", retenueH.List)
			r.Post("/retenues", retenueH.Create)
			r.Get("/retenues/{id}", retenueH.Get)
			r.Put("/retenues/{id}", retenueH.Update)
			r.Delete("/retenues/{id}", retenueH.Delete)
			r.Get("/retenues/{id}/export", retenueH.Export)

			// CNSS Patronal [Plan: Enterprise]
			r.Get("/cnss", cnssH.List)
			r.Post("/cnss/generer", cnssH.Generer)
			r.Get("/cnss/{id}", cnssH.Get)
			r.Put("/cnss/{id}/valider", cnssH.Valider)
			r.Delete("/cnss/{id}", cnssH.Delete)
			r.Get("/cnss/{id}/export", cnssH.Export)

			// Historique fiscal annuel
			r.Get("/historique-fiscal", histoH.Get)
			r.Get("/historique-fiscal/annees", histoH.Annees)

			// Exercice fiscal
			r.Get("/exercice/actif", exerciceH.Actif)
			r.Get("/exercice", exerciceH.List)
			r.Post("/exercice", exerciceH.Create)
			r.Put("/exercice/{id}", exerciceH.Update)
			r.Put("/exercice/{id}/cloturer", exerciceH.Cloturer)
		})
	})

	return r
}
