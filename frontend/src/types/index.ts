// ─── Fiscal types — CGI 2025 Burkina Faso ───────────────────

export interface Company {
    id: string;
    user_id: string;
    nom: string;
    ifu: string;
    rc: string;
    secteur: string;
    adresse: string;
    tel: string;
}

export interface Employee {
    id: string;
    company_id: string;
    nom: string;
    categorie: 'Cadre' | 'Non-cadre';
    cotisation: 'CNSS' | 'CARFO';
    charges: number;
    salaire_base: number;
    anciennete: number;
    heures_sup: number;
    logement: number;
    transport: number;
    fonction: number;
}

export interface CalculRequest {
    salaire_base: number;
    anciennete: number;
    heures_sup: number;
    logement: number;
    transport: number;
    fonction: number;
    charges: number;
    categorie: 'Cadre' | 'Non-cadre';
    cotisation: 'CNSS' | 'CARFO';
}

export interface CalculResult {
    brut_total: number;
    base_imposable: number;
    iuts_brut: number;
    iuts_net: number;
    cotisation_sociale: number;
    tpa: number;
    salaire_net: number;
    abattement_forfaitaire: number;
    abattement_familial: number;
    retenue_personnel: number;
}

export interface Declaration {
    id: string;
    company_id: string;
    periode: string;
    mois: number;
    annee: number;
    nb_salaries: number;
    brut_total: number;
    iuts_total: number;
    tpa_total: number;
    css_total: number;
    total: number;
    statut: 'ok' | 'retard' | 'en_cours';
    ref: string | null;
    date_depot: string | null;
    created_at: string;
}

export interface Bulletin {
    id: string;
    company_id: string;
    employee_id: string;
    mois: number;
    annee: number;
    periode: string;
    nom_employe: string;
    categorie: string;
    salaire_base: number;
    anciennete: number;
    heures_sup: number;
    logement: number;
    transport: number;
    fonction: number;
    charges: number;
    cotisation: string;
    brut_total: number;
    base_imposable: number;
    iuts_brut: number;
    iuts_net: number;
    cotisation_sociale: number;
    tpa: number;
    salaire_net: number;
    created_at: string;
}

export interface Simulation {
    id: string;
    company_id: string;
    label: string;
    cotisation: string;
    input_data: Record<string, unknown>;
    result_data: Record<string, unknown>;
    created_at: string;
}

export interface TVADeclaration {
    id: string;
    company_id: string;
    periode: string;
    mois: number;
    annee: number;
    ca_ttc: number;
    ca_ht: number;
    tva_collectee: number;
    tva_deductible: number;
    tva_nette: number;
    statut: string;
    ref: string | null;
    created_at: string;
    lignes?: TVALigne[];
}

export interface TVALigne {
    id: string;
    declaration_id: string;
    type_op: 'vente' | 'achat';
    description: string;
    montant_ht: number;
    taux_tva: number;
    montant_tva: number;
    montant_ttc: number;
}

export interface RetenueSource {
    id: string;
    company_id: string;
    periode: string;
    mois: number;
    annee: number;
    beneficiaire: string;
    type_retenue: string;
    montant_brut: number;
    taux_retenue: number;
    montant_retenue: number;
    montant_net: number;
    statut: string;
    ref: string | null;
    created_at: string;
}

export interface CNSSPatronal {
    id: string;
    company_id: string;
    periode: string;
    mois: number;
    annee: number;
    nb_salaries_cnss: number;
    nb_salaries_carfo: number;
    base_cnss: number;
    base_carfo: number;
    cotisation_pat_cnss: number;
    cotisation_sal_cnss: number;
    cotisation_pat_carfo: number;
    cotisation_sal_carfo: number;
    total_cnss: number;
    total_carfo: number;
    total_general: number;
    statut: string;
    created_at: string;
}

export interface IRFDeclaration {
    id: string;
    company_id: string;
    annee: number;
    loyer_brut: number;
    abattement: number;
    base_nette: number;
    irf1: number;
    irf2: number;
    irf_total: number;
    loyer_net: number;
    statut: string;
    ref: string | null;
    created_at: string;
}

export interface IRCMDeclaration {
    id: string;
    company_id: string;
    annee: number;
    montant_brut: number;
    type_revenu: 'CREANCES' | 'OBLIGATIONS' | 'DIVIDENDES';
    taux: number;
    ircm_total: number;
    montant_net: number;
    statut: string;
    ref: string | null;
    created_at: string;
}

export interface ISDeclaration {
    id: string;
    company_id: string;
    annee: number;
    ca: number;
    benefice: number;
    regime: string;
    adhesion_cga: boolean;
    is_theorique: number;
    mfp_du: number;
    is_du: number;
    statut: string;
    ref: string | null;
    created_at: string;
}

export interface CMEDeclaration {
    id: string;
    company_id: string;
    annee: number;
    ca: number;
    zone: 'A' | 'B' | 'C' | 'D';
    adhesion_cga: boolean;
    classe: number;
    cme: number;
    cme_net: number;
    statut: string;
    ref: string | null;
    created_at: string;
}

export interface PatenteDeclaration {
    id: string;
    company_id: string;
    annee: number;
    ca: number;
    valeur_locative: number;
    droit_fixe: number;
    droit_prop: number;
    total_patente: number;
    statut: string;
    ref: string | null;
    created_at: string;
}

export interface WorkflowEtape {
    id: string;
    declaration_id: string;
    etape: 'soumis' | 'en_revision' | 'approuve' | 'rejete';
    commentaire: string;
    user_id: string;
    created_at: string;
}

export interface HistoriqueFiscalAnnee {
    annee: number;
    iuts_total: number;
    tpa_total: number;
    css_total: number;
    cnss_patronal: number;
    tva_nette: number;
    retenue_total: number;
    total_obligations: number;
    mois: HistoriqueFiscalMois[];
}

export interface HistoriqueFiscalMois {
    mois: number;
    periode: string;
    iuts_total: number;
    tpa_total: number;
    css_total: number;
    cnss_patronal: number;
    tva_nette: number;
    retenue_total: number;
    total_obligations: number;
}

export interface BilanAnnuel {
    annee: number;
    iuts_total: number;
    tpa_total: number;
    css_total: number;
    cnss_patronal_total: number;
    tva_nette_total: number;
    ras_total: number;
    irf_total: number;
    ircm_total: number;
    is_total: number;
    mfp_total: number;
    cme_total: number;
    patente_total: number;
    grand_total: number;
    nb_declarations: number;
    nb_salaries: number;
}

export interface Notification {
    id: string;
    type: string;
    niveau: 'warning' | 'error' | 'info' | 'success';
    titre: string;
    message: string;
    periode?: string;
    ref?: string;
    lien?: string;
    lu: boolean;
}

export interface BilanData {
    annee: number;
    iuts: number;
    tpa: number;
    css: number;
    ras: number;
    tva: number;
    cnss_patronal: number;
    irf: number;
    ircm: number;
    is: number;
    cme: number;
    patente: number;
    total: number;
}

export interface User {
    id: string;
    email: string;
    plan: Plan;
    role: 'user' | 'super_admin';
    user_type: 'physique' | 'morale';
    org_id?: string;
    org_role?: 'org_admin' | 'comptable' | 'gestionnaire_rh' | 'auditeur';
    is_active: boolean;
    created_at: string;
}

export interface AuthResponse {
    token: string;
    refresh_token?: string;
    user: User;
}

export interface ExerciceFiscal {
    id: string;
    company_id: string;
    annee: number;
    date_debut: string;
    date_fin: string;
    statut: 'en_cours' | 'cloture';
    date_cloture: string | null;
    note: string;
    created_at: string;
}

export type Plan =
    | 'physique_starter'
    | 'physique_pro'
    | 'moral_team'
    | 'moral_enterprise'
    | 'starter'      // rétro-compat
    | 'pro'          // rétro-compat
    | 'enterprise';  // rétro-compat

const PHYSIQUE_STARTER_FEATURES = new Set([
    'dashboard', 'saisie', 'calcul', 'rapport', 'historique', 'export-csv', 'parametres',
]);
const PHYSIQUE_PRO_FEATURES = new Set([
    'dashboard', 'saisie', 'calcul', 'rapport', 'historique', 'bilan', 'export-csv', 'parametres',
    'bulletin', 'simulateur', 'tva', 'irf', 'ircm', 'import', 'n1-copy', 'notifications', 'assistant',
]);
const MORAL_FEATURES = new Set([
    'dashboard', 'saisie', 'calcul', 'rapport', 'historique', 'bilan', 'export-csv', 'parametres',
    'bulletin', 'simulateur', 'tva', 'irf', 'ircm', 'import', 'n1-copy', 'notifications', 'assistant',
    'multi-company', 'workflow', 'ras', 'cnss-patronal', 'cme', 'is', 'patente',
    'api-webhooks', 'audit-trail', 'dgi-connect', 'roles', 'archivage',
]);

export const PLAN_FEATURES: Record<Plan, Set<string>> = {
    physique_starter: PHYSIQUE_STARTER_FEATURES,
    physique_pro: PHYSIQUE_PRO_FEATURES,
    moral_team: MORAL_FEATURES,
    moral_enterprise: MORAL_FEATURES,
    // rétro-compat
    starter: PHYSIQUE_STARTER_FEATURES,
    pro: PHYSIQUE_PRO_FEATURES,
    enterprise: MORAL_FEATURES,
};

export const PLAN_LIMITS: Record<Plan, { employees: number; companies: number; users: number; historyMonths: number }> = {
    physique_starter: { employees: 3, companies: 1, users: 1, historyMonths: 3 },
    physique_pro: { employees: 10, companies: 1, users: 1, historyMonths: 12 },
    moral_team: { employees: 200, companies: 2, users: 5, historyMonths: 24 },
    moral_enterprise: { employees: Infinity, companies: Infinity, users: Infinity, historyMonths: 120 },
    // rétro-compat
    starter: { employees: 3, companies: 1, users: 1, historyMonths: 3 },
    pro: { employees: 10, companies: 1, users: 1, historyMonths: 12 },
    enterprise: { employees: Infinity, companies: Infinity, users: Infinity, historyMonths: 120 },
};

export const PLAN_LABELS: Record<Plan, string> = {
    physique_starter: 'Solo Starter',
    physique_pro: 'Solo Pro',
    moral_team: 'Équipe',
    moral_enterprise: 'Entreprise',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Entreprise',
};

export const MOIS_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// ─── Organisation (Personne Morale) ─────────────────────────

export interface Organization {
    id: string;
    nom: string;
    ifu: string;
    rccm: string;
    secteur: string;
    plan: Plan;
    max_users: number;
    max_companies: number;
    max_employees: number;
    owner_id: string | null;
    is_active: boolean;
    created_at: string;
}

export interface OrgMember {
    id: string;
    email: string;
    org_role: 'org_admin' | 'comptable' | 'gestionnaire_rh' | 'auditeur';
    is_active: boolean;
    created_at: string;
}

export interface OrgStats {
    member_count: number;
    company_count: number;
    max_users: number;
    max_companies: number;
    max_employees: number;
}

export interface OrgInfo {
    organization: Organization;
    stats: OrgStats;
}

export interface OrgCompanyAccess {
    user_id: string;
    email: string;
    org_role: string;
}

export interface OrgCompany {
    id: string;
    nom: string;
    ifu: string;
    secteur: string;
    is_active: boolean;
    members: OrgCompanyAccess[];
}

// ─── Super Admin types ────────────────────────────────────────

export interface License {
    id: string;
    user_id: string;
    plan: string;
    status: 'trial' | 'active' | 'suspended' | 'expired';
    trial_ends_at: string | null;
    expires_at: string | null;
    max_companies: number;
    max_employees: number;
    notes: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface AdminUser {
    id: string;
    email: string;
    plan: string;
    role: string;
    is_active: boolean;
    company_count: number;
    created_at: string;
    license?: License;
}

export interface AdminCompany {
    id: string;
    user_id: string;
    user_email: string;
    nom: string;
    ifu: string;
    secteur: string;
    is_active: boolean;
}

export interface AdminStats {
    total_users: number;
    active_users: number;
    suspended_users: number;
    trial_users: number;
    plan_starter: number;
    plan_pro: number;
    plan_enterprise: number;
    total_companies: number;
    active_companies: number;
    new_users_last30d: number;
    estimated_mrr: number;
}

export interface AuditLog {
    id: string;
    admin_id: string;
    admin_email: string;
    action: string;
    target_type: string;
    target_id: string | null;
    details: Record<string, unknown>;
    created_at: string;
}

