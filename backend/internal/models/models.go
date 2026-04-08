package models

import "time"

// ─── COMPANY ────────────────────────────────────────────────

type Company struct {
	ID      string `json:"id" db:"id"`
	UserID  string `json:"user_id" db:"user_id"`
	Nom     string `json:"nom" db:"nom"`
	IFU     string `json:"ifu" db:"ifu"`
	RC      string `json:"rc" db:"rc"`
	Secteur string `json:"secteur" db:"secteur"`
	Adresse string `json:"adresse" db:"adresse"`
	Tel     string `json:"tel" db:"tel"`
}

// ─── EMPLOYEE ────────────────────────────────────────────────

type Employee struct {
	ID          string  `json:"id" db:"id"`
	CompanyID   string  `json:"company_id" db:"company_id"`
	Nom         string  `json:"nom" db:"nom"`
	Categorie   string  `json:"categorie" db:"categorie"` // "Cadre" | "Non-cadre"
	Charges     int     `json:"charges" db:"charges"`
	SalaireBase float64 `json:"salaire_base" db:"salaire_base"`
	Anciennete  float64 `json:"anciennete" db:"anciennete"`
	HeuresSup   float64 `json:"heures_sup" db:"heures_sup"`
	Logement    float64 `json:"logement" db:"logement"`
	Transport   float64 `json:"transport" db:"transport"`
	Fonction    float64 `json:"fonction" db:"fonction"`
}

// ─── DECLARATION ─────────────────────────────────────────────

type Declaration struct {
	ID        string     `json:"id" db:"id"`
	CompanyID string     `json:"company_id" db:"company_id"`
	Periode   string     `json:"periode" db:"periode"` // "Avril 2026"
	Mois      int        `json:"mois" db:"mois"`
	Annee     int        `json:"annee" db:"annee"`
	NbSalarie int        `json:"nb_salaries" db:"nb_salaries"`
	BrutTotal float64    `json:"brut_total" db:"brut_total"`
	IUTSTotal float64    `json:"iuts_total" db:"iuts_total"`
	TPATotal  float64    `json:"tpa_total" db:"tpa_total"`
	CSSTotal  float64    `json:"css_total" db:"css_total"` // CNSS ou CARFO
	Total     float64    `json:"total" db:"total"`
	Statut    string     `json:"statut" db:"statut"` // "ok" | "retard" | "en_cours"
	Ref       *string    `json:"ref" db:"ref"`
	DateDepot *time.Time `json:"date_depot" db:"date_depot"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}

// ─── USER / AUTH ──────────────────────────────────────────────

type User struct {
	ID           string    `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Plan         string    `json:"plan" db:"plan"` // "starter" | "pro" | "enterprise"
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Nom      string `json:"nom"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// ─── CALCUL ───────────────────────────────────────────────────

type CalculRequest struct {
	SalaireBase float64 `json:"salaire_base"`
	Anciennete  float64 `json:"anciennete"`
	HeuresSup   float64 `json:"heures_sup"`
	Logement    float64 `json:"logement"`
	Transport   float64 `json:"transport"`
	Fonction    float64 `json:"fonction"`
	Charges     int     `json:"charges"`
	Cotisation  string  `json:"cotisation"` // "CNSS" | "CARFO"
}

type CalculResult struct {
	BrutTotal  float64 `json:"brut_total"`
	BaseImp    float64 `json:"base_imposable"`
	IUTSBrut   float64 `json:"iuts_brut"`
	IUTSNet    float64 `json:"iuts_net"`
	CotSoc     float64 `json:"cotisation_sociale"`
	TPA        float64 `json:"tpa"`
	SalaireNet float64 `json:"salaire_net"`
}
