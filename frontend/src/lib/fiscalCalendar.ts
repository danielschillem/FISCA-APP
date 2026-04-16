/**
 * Calendrier fiscal Burkina Faso — CGI 2025
 * Toutes les échéances légales par type d'impôt
 */

export type EcheanceType =
    | 'IUTS'
    | 'CNSS'
    | 'TVA'
    | 'IS_acompte'
    | 'IS_solde'
    | 'Patente'
    | 'IRF'
    | 'IRCM'
    | 'RAS'
    | 'CME'
    | 'TP';

export type EcheanceUrgence = 'critique' | 'proche' | 'normal' | 'passe';

export interface Echeance {
    id: string;
    type: EcheanceType;
    label: string;
    description: string;
    date: Date;
    /** Jour du mois limite (ex: 15) */
    jourLimite: number;
    /** Mois concerné (0-based, null = courant) */
    moisCible: number;
    annee: number;
    urgence: EcheanceUrgence;
    joursRestants: number;
    plan: 'starter' | 'pro' | 'enterprise' | 'all';
    reference: string; // article CGI
}

export interface GroupeEcheances {
    mois: number; // 0-based
    annee: number;
    label: string;
    echeances: Echeance[];
}

const TYPE_META: Record<EcheanceType, { label: string; color: string; plan: Echeance['plan']; ref: string }> = {
    IUTS:       { label: 'IUTS',              color: '#16a34a', plan: 'all',        ref: 'Art. 107-119 CGI' },
    CNSS:       { label: 'CNSS Patronal',     color: '#0891b2', plan: 'all',        ref: 'Code Sécurité Sociale' },
    TVA:        { label: 'TVA',               color: '#7c3aed', plan: 'pro',        ref: 'Art. 210-275 CGI' },
    IS_acompte: { label: 'IS — Acompte',      color: '#ea580c', plan: 'enterprise', ref: 'Art. 300 CGI' },
    IS_solde:   { label: 'IS — Solde annuel', color: '#dc2626', plan: 'enterprise', ref: 'Art. 301 CGI' },
    Patente:    { label: 'Patente',           color: '#ca8a04', plan: 'all',        ref: 'Art. 400-430 CGI' },
    IRF:        { label: 'IRF',               color: '#059669', plan: 'pro',        ref: 'Art. 145-170 CGI' },
    IRCM:       { label: 'IRCM',              color: '#2563eb', plan: 'pro',        ref: 'Art. 175-195 CGI' },
    RAS:        { label: 'Retenue à la source', color: '#9333ea', plan: 'enterprise', ref: 'Art. 245 CGI' },
    CME:        { label: 'CME',               color: '#0d9488', plan: 'enterprise', ref: 'Art. 350 CGI' },
    TP:         { label: 'Taxe Professionnelle', color: '#b45309', plan: 'all',     ref: 'Art. 450 CGI' },
};

export const TYPE_COLORS: Record<EcheanceType, string> = Object.fromEntries(
    Object.entries(TYPE_META).map(([k, v]) => [k, v.color])
) as Record<EcheanceType, string>;

function urgenceFor(jours: number): EcheanceUrgence {
    if (jours < 0) return 'passe';
    if (jours <= 3) return 'critique';
    if (jours <= 7) return 'proche';
    return 'normal';
}

function daysBetween(a: Date, b: Date): number {
    return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Génère toutes les échéances fiscales pour une année donnée.
 * Logique BF : la plupart sont le 15 du mois M+1 pour les obligations du mois M.
 */
export function getEcheancesAnnee(annee: number, today: Date = new Date()): Echeance[] {
    const echeances: Echeance[] = [];

    const add = (
        type: EcheanceType,
        description: string,
        jour: number,
        mois: number, // 0-based, mois de la date limite
        anneeDate: number = annee
    ) => {
        const meta = TYPE_META[type];
        const date = new Date(anneeDate, mois, jour);
        const joursRestants = daysBetween(today, date);
        echeances.push({
            id: `${type}-${anneeDate}-${mois}-${jour}`,
            type,
            label: meta.label,
            description,
            date,
            jourLimite: jour,
            moisCible: mois,
            annee: anneeDate,
            urgence: urgenceFor(joursRestants),
            joursRestants,
            plan: meta.plan,
            reference: meta.ref,
        });
    };

    // ── IUTS — le 15 du mois suivant (mensuel) ─────────────────────────────
    for (let m = 0; m < 12; m++) {
        const moisDeclaration = m + 1 > 11 ? 0 : m + 1;
        const anneeDeclaration = m + 1 > 11 ? annee + 1 : annee;
        add('IUTS', `Déclaration et paiement IUTS — ${nomMois(m)} ${annee}`, 15, moisDeclaration, anneeDeclaration);
    }

    // ── CNSS Patronal — le 15 du mois suivant ──────────────────────────────
    for (let m = 0; m < 12; m++) {
        const moisDecl = m + 1 > 11 ? 0 : m + 1;
        const anneeDecl = m + 1 > 11 ? annee + 1 : annee;
        add('CNSS', `Cotisations CNSS/CARFO — ${nomMois(m)} ${annee}`, 15, moisDecl, anneeDecl);
    }

    // ── TVA — le 15 du mois suivant ────────────────────────────────────────
    for (let m = 0; m < 12; m++) {
        const moisDecl = m + 1 > 11 ? 0 : m + 1;
        const anneeDecl = m + 1 > 11 ? annee + 1 : annee;
        add('TVA', `Déclaration TVA — ${nomMois(m)} ${annee}`, 15, moisDecl, anneeDecl);
    }

    // ── Retenue à la source — le 15 du mois suivant ────────────────────────
    for (let m = 0; m < 12; m++) {
        const moisDecl = m + 1 > 11 ? 0 : m + 1;
        const anneeDecl = m + 1 > 11 ? annee + 1 : annee;
        add('RAS', `Retenue à la source — ${nomMois(m)} ${annee}`, 15, moisDecl, anneeDecl);
    }

    // ── IS — 4 acomptes trimestriels (31 mars, 30 juin, 30 sept, 31 déc) ──
    add('IS_acompte', `IS 1er acompte (25% de l'IS N-1) — T1 ${annee}`, 31, 2); // 31 mars
    add('IS_acompte', `IS 2e acompte (25% de l'IS N-1) — T2 ${annee}`, 30, 5);  // 30 juin
    add('IS_acompte', `IS 3e acompte (25% de l'IS N-1) — T3 ${annee}`, 30, 8);  // 30 sept
    add('IS_acompte', `IS 4e acompte (25% de l'IS N-1) — T4 ${annee}`, 31, 11); // 31 déc

    // ── IS — Solde annuel au 31 mars de l'année suivante ──────────────────
    add('IS_solde', `IS Solde annuel — Exercice ${annee}`, 31, 2, annee + 1);

    // ── Patente — 31 janvier ───────────────────────────────────────────────
    add('Patente', `Déclaration et paiement Patente — ${annee}`, 31, 0);

    // ── IRF — 30 avril ────────────────────────────────────────────────────
    add('IRF', `Déclaration IRF (revenus fonciers) — ${annee - 1}`, 30, 3);

    // ── IRCM — 30 avril ───────────────────────────────────────────────────
    add('IRCM', `Déclaration IRCM (capitaux mobiliers) — ${annee - 1}`, 30, 3);

    // ── CME — le 15 du mois suivant (mensuel) ──────────────────────────────
    for (let m = 0; m < 12; m++) {
        const moisDecl = m + 1 > 11 ? 0 : m + 1;
        const anneeDecl = m + 1 > 11 ? annee + 1 : annee;
        add('CME', `CME Micro-Entreprises — ${nomMois(m)} ${annee}`, 15, moisDecl, anneeDecl);
    }

    // ── Taxe Professionnelle — 31 janvier ─────────────────────────────────
    add('TP', `Taxe Professionnelle — ${annee}`, 31, 0);

    return echeances.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Retourne les N prochaines échéances à partir d'aujourd'hui */
export function getProchaines(annee: number, n = 5, today: Date = new Date()): Echeance[] {
    return getEcheancesAnnee(annee, today)
        .filter(e => e.joursRestants >= 0)
        .slice(0, n);
}

/** Groupe les échéances par mois */
export function grouperParMois(echeances: Echeance[]): GroupeEcheances[] {
    const map = new Map<string, GroupeEcheances>();
    for (const e of echeances) {
        const key = `${e.annee}-${e.moisCible}`;
        if (!map.has(key)) {
            map.set(key, {
                mois: e.moisCible,
                annee: e.annee,
                label: `${nomMois(e.moisCible)} ${e.annee}`,
                echeances: [],
            });
        }
        map.get(key)!.echeances.push(e);
    }
    return Array.from(map.values()).sort((a, b) =>
        new Date(a.annee, a.mois).getTime() - new Date(b.annee, b.mois).getTime()
    );
}

const NOMS_MOIS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export function nomMois(m: number): string {
    return NOMS_MOIS[m] ?? '';
}
