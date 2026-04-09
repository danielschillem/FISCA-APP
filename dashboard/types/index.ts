// ─── Types partagés FISCA ────────────────────────────────────

export interface User {
    id: string
    email: string
    plan: 'starter' | 'pro' | 'enterprise'
    created_at: string
}

export interface AuthResponse {
    token: string
    refresh_token?: string
    user: User
}

export interface Company {
    id: string
    user_id: string
    nom: string
    ifu: string
    rc: string
    secteur: string
    adresse: string
    tel: string
}

export type StatutExercice = 'en_cours' | 'cloture'

export interface ExerciceFiscal {
    id: string
    company_id: string
    annee: number
    date_debut: string   // "YYYY-MM-DD"
    date_fin: string     // "YYYY-MM-DD"
    statut: StatutExercice
    date_cloture: string | null
    note: string
    created_at: string
}

export interface Employee {
    id?: string
    company_id?: string
    nom: string
    categorie: 'Cadre' | 'Non-cadre'
    cotisation: 'CNSS' | 'CARFO'
    charges: number
    salaire_base: number
    anciennete: number
    heures_sup: number
    logement: number
    transport: number
    fonction: number
}

export interface Declaration {
    id: string
    company_id: string
    periode: string
    mois: number
    annee: number
    nb_salaries: number
    brut_total: number
    iuts_total: number
    tpa_total: number
    css_total: number
    total: number
    statut: 'ok' | 'retard' | 'en_cours' | 'soumise' | 'approuvee' | 'rejetee'
    ref: string | null
    date_depot: string | null
    created_at: string
}

export interface CalculRequest {
    salaire_base: number
    anciennete: number
    heures_sup: number
    logement: number
    transport: number
    fonction: number
    charges: number
    cotisation: 'CNSS' | 'CARFO'
}

export interface CalculResult {
    brut_total: number
    base_imposable: number
    iuts_brut: number
    iuts_net: number
    cotisation_sociale: number
    tpa: number
    salaire_net: number
}

// Plans
export const PLAN_LABELS: Record<string, string> = {
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Entreprise',
}

export const PLAN_COLORS: Record<string, string> = {
    starter: '#6b7280',
    pro: '#24a05a',
    enterprise: '#f97316',
}

// ─── Nouveaux types ───────────────────────────────────────────

export interface DashboardMois {
    mois: number
    annee: number
    periode: string
    brut_total: number
    iuts_total: number
    tpa_total: number
    css_total: number
    total: number
    nb_salaries: number
    statut: string
}

export interface DashboardData {
    nb_employes: number
    nb_declarations: number
    mois_courant: DashboardMois
    mois_precedent: DashboardMois
    evolution_iuts_pct: number
    evolution_brut_pct: number
    total_annee: { annee: number; brut_total: number; iuts_total: number; tpa_total: number; css_total: number; total: number }
    alertes_retard: { declaration_id: string; ref: string; periode: string; mois: number; annee: number; statut: string }[]
    plan: { plan: string; nb_employes: number; limite_employes: number }
}

export interface Notification {
    id: string
    type: string
    niveau: 'warning' | 'error' | 'info' | 'success'
    titre: string
    message: string
    periode?: string
    ref?: string
    lien?: string
}

export interface Bulletin {
    id: string
    company_id: string
    employee_id: string
    mois: number
    annee: number
    periode: string
    nom_employe: string
    categorie: string
    salaire_base: number
    anciennete: number
    heures_sup: number
    logement: number
    transport: number
    fonction: number
    charges: number
    cotisation: string
    brut_total: number
    base_imposable: number
    iuts_brut: number
    iuts_net: number
    cotisation_sociale: number
    tpa: number
    salaire_net: number
    created_at: string
}

export interface Simulation {
    id: string
    company_id: string
    label: string
    cotisation: string
    input_data: CalculRequest
    result_data: CalculResult
    created_at: string
}

export interface TVALigne {
    id: string
    declaration_id: string
    type_op: 'vente' | 'achat'
    description: string
    montant_ht: number
    taux_tva: number
    montant_tva: number
    montant_ttc: number
}

export interface TVADeclaration {
    id: string
    company_id: string
    periode: string
    mois: number
    annee: number
    ca_ttc: number
    ca_ht: number
    tva_collectee: number
    tva_deductible: number
    tva_nette: number
    statut: string
    ref: string | null
    created_at: string
    lignes?: TVALigne[]
}

export interface WorkflowEtape {
    id: string
    declaration_id: string
    etape: string
    commentaire: string
    user_id: string
    created_at: string
}

// ─── Retenue à la source ─────────────────────────────────────

export type TypeRetenue = 'services' | 'loyer' | 'dividendes' | 'interets' | 'autre'

export const TYPE_RETENUE_LABELS: Record<TypeRetenue, string> = {
    services: 'Services / Honoraires',
    loyer: 'Loyer / Revenus locatifs',
    dividendes: 'Dividendes',
    interets: 'Intérêts',
    autre: 'Autre',
}

export const TAUX_RETENUE_DEFAULT: Record<TypeRetenue, number> = {
    services: 20,
    loyer: 15,
    dividendes: 12.5,
    interets: 10,
    autre: 25,
}

export interface RetenueSource {
    id: string
    company_id: string
    periode: string
    mois: number
    annee: number
    beneficiaire: string
    type_retenue: TypeRetenue
    montant_brut: number
    taux_retenue: number
    montant_retenue: number
    montant_net: number
    statut: string
    ref: string | null
    created_at: string
}

// ─── CNSS Patronal ───────────────────────────────────────────

export interface CNSSPatronal {
    id: string
    company_id: string
    periode: string
    mois: number
    annee: number
    nb_salaries_cnss: number
    nb_salaries_carfo: number
    base_cnss: number
    base_carfo: number
    cotisation_pat_cnss: number
    cotisation_sal_cnss: number
    cotisation_pat_carfo: number
    cotisation_sal_carfo: number
    total_cnss: number
    total_carfo: number
    total_general: number
    statut: string
    created_at: string
}

// ─── Historique fiscal ───────────────────────────────────────

export interface HistoriqueFiscalMois {
    mois: number
    periode: string
    iuts_total: number
    tpa_total: number
    css_total: number
    cnss_patronal: number
    tva_nette: number
    retenue_total: number
    total_obligations: number
}

export interface HistoriqueFiscalAnnee {
    annee: number
    iuts_total: number
    tpa_total: number
    css_total: number
    cnss_patronal: number
    tva_nette: number
    retenue_total: number
    total_obligations: number
    mois: HistoriqueFiscalMois[]
}
