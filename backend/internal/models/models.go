package models

import (
	"encoding/json"
	"time"
)

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

// ─── EXERCICE FISCAL ─────────────────────────────────────────

type ExerciceFiscal struct {
	ID          string     `json:"id"`
	CompanyID   string     `json:"company_id"`
	Annee       int        `json:"annee"`
	DateDebut   string     `json:"date_debut"` // "2026-01-01"
	DateFin     string     `json:"date_fin"`   // "2026-12-31"
	Statut      string     `json:"statut"`     // "en_cours" | "cloture"
	DateCloture *time.Time `json:"date_cloture"`
	Note        string     `json:"note"`
	CreatedAt   time.Time  `json:"created_at"`
}

// ─── EMPLOYEE ────────────────────────────────────────────────

type Employee struct {
	ID          string  `json:"id" db:"id"`
	CompanyID   string  `json:"company_id" db:"company_id"`
	Nom         string  `json:"nom" db:"nom"`
	Categorie   string  `json:"categorie" db:"categorie"`   // "Cadre" | "Non-cadre"
	Cotisation  string  `json:"cotisation" db:"cotisation"` // "CNSS" | "CARFO"
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
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	User         User   `json:"user"`
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

// ─── BULLETIN DE PAIE ─────────────────────────────────────────

type Bulletin struct {
	ID          string    `json:"id"`
	CompanyID   string    `json:"company_id"`
	EmployeeID  string    `json:"employee_id"`
	Mois        int       `json:"mois"`
	Annee       int       `json:"annee"`
	Periode     string    `json:"periode"`
	NomEmploye  string    `json:"nom_employe"`
	Categorie   string    `json:"categorie"`
	SalaireBase float64   `json:"salaire_base"`
	Anciennete  float64   `json:"anciennete"`
	HeuresSup   float64   `json:"heures_sup"`
	Logement    float64   `json:"logement"`
	Transport   float64   `json:"transport"`
	Fonction    float64   `json:"fonction"`
	Charges     int       `json:"charges"`
	Cotisation  string    `json:"cotisation"`
	BrutTotal   float64   `json:"brut_total"`
	BaseImp     float64   `json:"base_imposable"`
	IUTSBrut    float64   `json:"iuts_brut"`
	IUTSNet     float64   `json:"iuts_net"`
	CotSoc      float64   `json:"cotisation_sociale"`
	TPA         float64   `json:"tpa"`
	SalaireNet  float64   `json:"salaire_net"`
	CreatedAt   time.Time `json:"created_at"`
}

// ─── SIMULATION FISCALE ───────────────────────────────────────

type Simulation struct {
	ID         string          `json:"id"`
	CompanyID  string          `json:"company_id"`
	Label      string          `json:"label"`
	Cotisation string          `json:"cotisation"`
	InputData  json.RawMessage `json:"input_data"`
	ResultData json.RawMessage `json:"result_data"`
	CreatedAt  time.Time       `json:"created_at"`
}

// ─── TVA ─────────────────────────────────────────────────────

type TVADeclaration struct {
	ID            string     `json:"id"`
	CompanyID     string     `json:"company_id"`
	Periode       string     `json:"periode"`
	Mois          int        `json:"mois"`
	Annee         int        `json:"annee"`
	CaTTC         float64    `json:"ca_ttc"`
	CaHT          float64    `json:"ca_ht"`
	TVACollectee  float64    `json:"tva_collectee"`
	TVADeductible float64    `json:"tva_deductible"`
	TVANette      float64    `json:"tva_nette"`
	Statut        string     `json:"statut"`
	Ref           *string    `json:"ref"`
	CreatedAt     time.Time  `json:"created_at"`
	Lignes        []TVALigne `json:"lignes,omitempty"`
}

type TVALigne struct {
	ID            string  `json:"id"`
	DeclarationID string  `json:"declaration_id"`
	TypeOp        string  `json:"type_op"` // "vente" | "achat"
	Description   string  `json:"description"`
	MontantHT     float64 `json:"montant_ht"`
	TauxTVA       float64 `json:"taux_tva"` // 18.00 par défaut
	MontantTVA    float64 `json:"montant_tva"`
	MontantTTC    float64 `json:"montant_ttc"`
}

// ─── WORKFLOW APPROBATION ─────────────────────────────────────

type WorkflowEtape struct {
	ID            string    `json:"id"`
	DeclarationID string    `json:"declaration_id"`
	Etape         string    `json:"etape"` // "soumis"|"en_revision"|"approuve"|"rejete"
	Commentaire   string    `json:"commentaire"`
	UserID        string    `json:"user_id"`
	CreatedAt     time.Time `json:"created_at"`
}

// ─── RETENUE À LA SOURCE ──────────────────────────────────────

type RetenueSource struct {
	ID             string    `json:"id"`
	CompanyID      string    `json:"company_id"`
	Periode        string    `json:"periode"`
	Mois           int       `json:"mois"`
	Annee          int       `json:"annee"`
	Beneficiaire   string    `json:"beneficiaire"`
	TypeRetenue    string    `json:"type_retenue"` // "services"|"loyer"|"dividendes"|"interets"|"autre"
	MontantBrut    float64   `json:"montant_brut"`
	TauxRetenue    float64   `json:"taux_retenue"` // en %
	MontantRetenue float64   `json:"montant_retenue"`
	MontantNet     float64   `json:"montant_net"`
	Statut         string    `json:"statut"` // "en_cours"|"declare"
	Ref            *string   `json:"ref"`
	CreatedAt      time.Time `json:"created_at"`
}

// ─── CNSS PATRONAL ────────────────────────────────────────────

type CNSSPatronal struct {
	ID                 string    `json:"id"`
	CompanyID          string    `json:"company_id"`
	Periode            string    `json:"periode"`
	Mois               int       `json:"mois"`
	Annee              int       `json:"annee"`
	NbSalariesCNSS     int       `json:"nb_salaries_cnss"`
	NbSalariesCARFO    int       `json:"nb_salaries_carfo"`
	BaseCNSS           float64   `json:"base_cnss"`
	BaseCARFO          float64   `json:"base_carfo"`
	CotisationPatCNSS  float64   `json:"cotisation_pat_cnss"`  // 16% de BaseCNSS
	CotisationSalCNSS  float64   `json:"cotisation_sal_cnss"`  // 5.5% de BaseCNSS
	CotisationPatCARFO float64   `json:"cotisation_pat_carfo"` // 7% de BaseCARFO
	CotisationSalCARFO float64   `json:"cotisation_sal_carfo"` // 6% de BaseCARFO
	TotalCNSS          float64   `json:"total_cnss"`
	TotalCARFO         float64   `json:"total_carfo"`
	TotalGeneral       float64   `json:"total_general"`
	Statut             string    `json:"statut"` // "brouillon"|"valide"
	CreatedAt          time.Time `json:"created_at"`
}

// ─── HISTORIQUE FISCAL ────────────────────────────────────────

type HistoriqueFiscalMois struct {
	Mois         int     `json:"mois"`
	Periode      string  `json:"periode"`
	IUTSTotal    float64 `json:"iuts_total"`
	TPATotal     float64 `json:"tpa_total"`
	CSSTotal     float64 `json:"css_total"`
	CNSSPatronal float64 `json:"cnss_patronal"`
	TVANette     float64 `json:"tva_nette"`
	RetenueTotal float64 `json:"retenue_total"`
	TotalOblig   float64 `json:"total_obligations"`
}

type HistoriqueFiscalAnnee struct {
	Annee        int                    `json:"annee"`
	IUTSTotal    float64                `json:"iuts_total"`
	TPATotal     float64                `json:"tpa_total"`
	CSSTotal     float64                `json:"css_total"`
	CNSSPatronal float64                `json:"cnss_patronal"`
	TVANette     float64                `json:"tva_nette"`
	RetenueTotal float64                `json:"retenue_total"`
	TotalOblig   float64                `json:"total_obligations"`
	Mois         []HistoriqueFiscalMois `json:"mois"`
}
