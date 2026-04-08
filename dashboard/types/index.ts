// ─── Types partagés FISCA ────────────────────────────────────

export interface User {
    id: string
    email: string
    plan: 'starter' | 'pro' | 'enterprise'
    created_at: string
}

export interface AuthResponse {
    token: string
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

export interface Employee {
    id?: string
    company_id?: string
    nom: string
    categorie: 'Cadre' | 'Non-cadre'
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
    statut: 'ok' | 'retard' | 'en_cours'
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
