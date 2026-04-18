package models

import (
	"encoding/json"
	"time"
)

// --- PAYMENT -------------------------------------------------

type Payment struct {
	ID              string     `json:"id"`
	CompanyID       string     `json:"company_id"`
	UserID          string     `json:"user_id"`
	DocumentType    string     `json:"document_type"`
	DocumentID      string     `json:"document_id"`
	MontantBase     float64    `json:"montant_base"`
	TauxFrais       float64    `json:"taux_frais"`
	Frais           float64    `json:"frais"`
	Total           float64    `json:"total"`
	Telephone       string     `json:"telephone"`
	Statut          string     `json:"statut"` // pending | completed | failed | expired
	OMReference     *string    `json:"om_reference,omitempty"`
	OMOrderID       *string    `json:"om_order_id,omitempty"`
	WebhookReceived bool       `json:"webhook_received"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type InitiatePaymentRequest struct {
	DocumentType string  `json:"document_type"` // 'iuts','tva','retenues','is','ircm','cme','irf','bulletin','patente'
	DocumentID   string  `json:"document_id"`
	Telephone    string  `json:"telephone"`    // ex: "70123456" ou "+22670123456"
	MontantBase  float64 `json:"montant_base"` // optionnel, défaut 2000
}

type PaymentStatusResponse struct {
	ID       string  `json:"id"`
	Statut   string  `json:"statut"`
	Total    float64 `json:"total"`
	Frais    float64 `json:"frais"`
}

// --- COMPANY ------------------------------------------------

type Company struct {
	ID      string `json:"id" db:"id"`
	UserID  string `json:"user_id" db:"user_id"`
	Nom     string `json:"nom" db:"nom"`
	IFU     string `json:"ifu" db:"ifu"`
	RC      string `json:"rc" db:"rc"`
	Secteur string `json:"secteur" db:"secteur"`
	Adresse string `json:"adresse" db:"adresse"`
	Tel     string `json:"tel" db:"tel"`
	// Champs DGI contribuable
	FormeJuridique    string `json:"forme_juridique" db:"forme_juridique"`
	Regime            string `json:"regime" db:"regime"`
	CentreImpots      string `json:"centre_impots" db:"centre_impots"`
	CodeActivite      string `json:"code_activite" db:"code_activite"`
	DateDebutActivite string `json:"date_debut_activite" db:"date_debut_activite"`
	EmailEntreprise   string `json:"email_entreprise" db:"email_entreprise"`
	Ville             string `json:"ville" db:"ville"`
	Quartier          string `json:"quartier" db:"quartier"`
	BP                string `json:"bp" db:"bp"`
	Fax               string `json:"fax" db:"fax"`
}

// --- EXERCICE FISCAL -----------------------------------------

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

// --- EMPLOYEE ------------------------------------------------

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

// --- DECLARATION ---------------------------------------------

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

// --- USER / AUTH ----------------------------------------------

type User struct {
	ID           string    `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Plan         string    `json:"plan" db:"plan"` // "physique_starter"|"physique_pro"|"moral_team"|"moral_enterprise"
	Role         string    `json:"role" db:"role"` // "user" | "super_admin"
	UserType     string    `json:"user_type"`      // "physique" | "morale"
	OrgID        *string   `json:"org_id"`         // nil pour les personnes physiques
	OrgRole      *string   `json:"org_role"`       // "org_admin"|"comptable"|"gestionnaire_rh"|"auditeur"
	IsActive     bool      `json:"is_active" db:"is_active"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Nom      string `json:"nom"`       // nom de l'entreprise (physique) ou de la structure (morale)
	Plan     string `json:"plan"`      // physique_starter | physique_pro | moral_team | moral_enterprise
	UserType string `json:"user_type"` // "physique" | "morale"
}

type AuthResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	User         User   `json:"user"`
}

// --- ORGANISATION (Personne Morale) --------------------------

type Organization struct {
	ID           string    `json:"id"`
	Nom          string    `json:"nom"`
	IFU          string    `json:"ifu"`
	RCCM         string    `json:"rccm"`
	Secteur      string    `json:"secteur"`
	Plan         string    `json:"plan"`
	MaxUsers     int       `json:"max_users"`
	MaxCompanies int       `json:"max_companies"`
	MaxEmployees int       `json:"max_employees"`
	OwnerID      *string   `json:"owner_id"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
}

type OrgMember struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	OrgRole   string    `json:"org_role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type OrgStats struct {
	MemberCount  int `json:"member_count"`
	CompanyCount int `json:"company_count"`
	MaxUsers     int `json:"max_users"`
	MaxCompanies int `json:"max_companies"`
	MaxEmployees int `json:"max_employees"`
}

type OrgInfo struct {
	Organization Organization `json:"organization"`
	Stats        OrgStats     `json:"stats"`
}

// --- CALCUL ---------------------------------------------------

type CalculRequest struct {
	SalaireBase float64 `json:"salaire_base"`
	Anciennete  float64 `json:"anciennete"`
	HeuresSup   float64 `json:"heures_sup"`
	Logement    float64 `json:"logement"`
	Transport   float64 `json:"transport"`
	Fonction    float64 `json:"fonction"`
	Charges     int     `json:"charges"`
	Categorie   string  `json:"categorie"`  // "Cadre" | "Non-cadre"
	Cotisation  string  `json:"cotisation"` // "CNSS" | "CARFO"
}

type CalculResult struct {
	BrutTotal    float64 `json:"brut_total"`
	BaseImp      float64 `json:"base_imposable"`
	IUTSBrut     float64 `json:"iuts_brut"`
	IUTSNet      float64 `json:"iuts_net"`
	CotSoc       float64 `json:"cotisation_sociale"`
	TPA          float64 `json:"tpa"`
	FSP          float64 `json:"fsp"` // Fonds de Soutien Patriotique 1 %
	SalaireNet   float64 `json:"salaire_net"`
	AbattForf    float64 `json:"abattement_forfaitaire"`
	AbattFam     float64 `json:"abattement_familial"`
	RetPersonnel float64 `json:"retenue_personnel"` // alias FSP - rétro-compat
}

// --- BULLETIN DE PAIE -----------------------------------------

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
	FSP         float64   `json:"fsp"` // Fonds de Soutien Patriotique 1 %
	SalaireNet  float64   `json:"salaire_net"`
	CreatedAt   time.Time `json:"created_at"`
}

// --- SIMULATION FISCALE ---------------------------------------

type Simulation struct {
	ID         string          `json:"id"`
	CompanyID  string          `json:"company_id"`
	Label      string          `json:"label"`
	Cotisation string          `json:"cotisation"`
	InputData  json.RawMessage `json:"input_data"`
	ResultData json.RawMessage `json:"result_data"`
	CreatedAt  time.Time       `json:"created_at"`
}

// --- TVA -----------------------------------------------------

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

// --- WORKFLOW APPROBATION -------------------------------------

type WorkflowEtape struct {
	ID            string    `json:"id"`
	DeclarationID string    `json:"declaration_id"`
	Etape         string    `json:"etape"` // "soumis"|"en_revision"|"approuve"|"rejete"
	Commentaire   string    `json:"commentaire"`
	UserID        string    `json:"user_id"`
	CreatedAt     time.Time `json:"created_at"`
}

// --- RETENUE À LA SOURCE --------------------------------------

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

// --- CNSS PATRONAL --------------------------------------------

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

// --- HISTORIQUE FISCAL ----------------------------------------

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

// --- IRF - Revenus Fonciers (CGI 2025 Art. 121-126) ----------

type IRFDeclaration struct {
	ID         string    `json:"id"`
	CompanyID  string    `json:"company_id"`
	Annee      int       `json:"annee"`
	LoyerBrut  float64   `json:"loyer_brut"`
	Abattement float64   `json:"abattement"`
	BaseNette  float64   `json:"base_nette"`
	IRF1       float64   `json:"irf1"` // tranche 18 %
	IRF2       float64   `json:"irf2"` // tranche 25 %
	IRFTotal   float64   `json:"irf_total"`
	LoyerNet   float64   `json:"loyer_net"`
	Statut     string    `json:"statut"`
	Ref        *string   `json:"ref"`
	CreatedAt  time.Time `json:"created_at"`
}

// --- IRCM - Capitaux Mobiliers (CGI 2025 Art. 140) -----------

type IRCMDeclaration struct {
	ID          string    `json:"id"`
	CompanyID   string    `json:"company_id"`
	Annee       int       `json:"annee"`
	MontantBrut float64   `json:"montant_brut"`
	TypeRevenu  string    `json:"type_revenu"` // "CREANCES"|"OBLIGATIONS"|"DIVIDENDES"
	Taux        float64   `json:"taux"`
	IRCMTotal   float64   `json:"ircm_total"`
	MontantNet  float64   `json:"montant_net"`
	Statut      string    `json:"statut"`
	Ref         *string   `json:"ref"`
	CreatedAt   time.Time `json:"created_at"`
}

// --- IS / MFP (CGI 2025 Art. 42) -----------------------------

type ISDeclaration struct {
	ID          string    `json:"id"`
	CompanyID   string    `json:"company_id"`
	Annee       int       `json:"annee"`
	CA          float64   `json:"ca"`
	Benefice    float64   `json:"benefice"`
	Regime      string    `json:"regime"` // "reel"|"simplifie"
	AdhesionCGA bool      `json:"adhesion_cga"`
	ISTheorique float64   `json:"is_theorique"`
	MFPDu       float64   `json:"mfp_du"`
	ISDu        float64   `json:"is_du"` // max(ISTheorique, MFPDu)
	Statut      string    `json:"statut"`
	Ref         *string   `json:"ref"`
	CreatedAt   time.Time `json:"created_at"`
}

// --- CME - Micro-Entreprises (CGI 2025 Art. 533) -------------

type CMEDeclaration struct {
	ID          string    `json:"id"`
	CompanyID   string    `json:"company_id"`
	Annee       int       `json:"annee"`
	CA          float64   `json:"ca"`
	Zone        string    `json:"zone"` // "A"|"B"|"C"|"D"
	AdhesionCGA bool      `json:"adhesion_cga"`
	Classe      int       `json:"classe"`
	CME         float64   `json:"cme"`
	CMENet      float64   `json:"cme_net"`
	Statut      string    `json:"statut"`
	Ref         *string   `json:"ref"`
	CreatedAt   time.Time `json:"created_at"`
}

// --- PATENTE (CGI 2025 Art. 237-240) -------------------------

type PatenteDeclaration struct {
	ID             string    `json:"id"`
	CompanyID      string    `json:"company_id"`
	Annee          int       `json:"annee"`
	CA             float64   `json:"ca"`
	ValeurLocative float64   `json:"valeur_locative"`
	DroitFixe      float64   `json:"droit_fixe"`
	DroitProp      float64   `json:"droit_prop"`
	TotalPatente   float64   `json:"total_patente"`
	Statut         string    `json:"statut"`
	Ref            *string   `json:"ref"`
	CreatedAt      time.Time `json:"created_at"`
}

// --- BILAN ANNUEL ---------------------------------------------

type BilanAnnuel struct {
	Annee          int     `json:"annee"`
	IUTSTotal      float64 `json:"iuts_total"`
	TPATotal       float64 `json:"tpa_total"`
	CSSTotal       float64 `json:"css_total"`
	CNSSPatTotal   float64 `json:"cnss_patronal_total"`
	TVANette       float64 `json:"tva_nette_total"`
	RASTotal       float64 `json:"ras_total"`
	IRFTotal       float64 `json:"irf_total"`
	IRCMTotal      float64 `json:"ircm_total"`
	ISTotal        float64 `json:"is_total"`
	MFPTotal       float64 `json:"mfp_total"`
	CMETotal       float64 `json:"cme_total"`
	PatenteTotal   float64 `json:"patente_total"`
	GrandTotal     float64 `json:"grand_total"`
	NbDeclarations int     `json:"nb_declarations"`
	NbSalaries     int     `json:"nb_salaries"`
}

// --- NOTIFICATION ---------------------------------------------

type Notification struct {
	ID        string    `json:"id"`
	CompanyID string    `json:"company_id"`
	Type      string    `json:"type"` // "alerte"|"info"|"succes"|"retard"
	Titre     string    `json:"titre"`
	Message   string    `json:"message"`
	Lu        bool      `json:"lu"`
	CreatedAt time.Time `json:"created_at"`
}

// --- SUPER ADMIN ----------------------------------------------

type License struct {
	ID           string     `json:"id"`
	UserID       string     `json:"user_id"`
	Plan         string     `json:"plan"`   // "starter"|"pro"|"enterprise"|"custom"
	Status       string     `json:"status"` // "trial"|"active"|"suspended"|"expired"
	TrialEndsAt  *time.Time `json:"trial_ends_at"`
	ExpiresAt    *time.Time `json:"expires_at"`
	MaxCompanies int        `json:"max_companies"`
	MaxEmployees int        `json:"max_employees"`
	Notes        string     `json:"notes"`
	CreatedBy    *string    `json:"created_by"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type AuditLog struct {
	ID         string          `json:"id"`
	AdminID    string          `json:"admin_id"`
	AdminEmail string          `json:"admin_email,omitempty"`
	Action     string          `json:"action"`
	TargetType string          `json:"target_type"`
	TargetID   *string         `json:"target_id"`
	Details    json.RawMessage `json:"details"`
	CreatedAt  time.Time       `json:"created_at"`
}

type AdminStats struct {
	TotalUsers      int     `json:"total_users"`
	ActiveUsers     int     `json:"active_users"`
	SuspendedUsers  int     `json:"suspended_users"`
	TrialUsers      int     `json:"trial_users"`
	PlanStarter     int     `json:"plan_starter"`
	PlanPro         int     `json:"plan_pro"`
	PlanEnterprise  int     `json:"plan_enterprise"`
	TotalCompanies  int     `json:"total_companies"`
	ActiveCompanies int     `json:"active_companies"`
	NewUsersLast30d int     `json:"new_users_last30d"`
	EstimatedMRR    float64 `json:"estimated_mrr"`
}

type AdminUser struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Plan         string    `json:"plan"`
	Role         string    `json:"role"`
	IsActive     bool      `json:"is_active"`
	CompanyCount int       `json:"company_count"`
	CreatedAt    time.Time `json:"created_at"`
	License      *License  `json:"license,omitempty"`
}

type AdminCompany struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	UserEmail string    `json:"user_email"`
	Nom       string    `json:"nom"`
	IFU       string    `json:"ifu"`
	Secteur   string    `json:"secteur"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}
