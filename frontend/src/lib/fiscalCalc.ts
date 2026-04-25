// --- Fiscal calculation utilities (mirroring CGI 2025 engine) -
import { getFiscalRules } from '../contribuable/fiscalRules';

// Formateur PDF-safe : espace ASCII ordinaire comme séparateur de milliers.
// toLocaleString('fr-FR') produit \u202F (espace fine insécable) non rendu
// par les polices embarquées de jsPDF (affichage "/" au lieu d'espace).
const numFmt = (n: number): string =>
    Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');

export const fmt = (n: number): string => `${numFmt(n)} FCFA`;

export const fmtN = (n: number): string => numFmt(n);

export const pct = (n: number): string =>
    (n * 100).toFixed(1) + ' %';

export function calcIUTS(baseImp: number): number {
    const rules = getFiscalRules();
    let impot = 0;
    let prev = 0;
    for (const t of rules.iutsTranches) {
        if (baseImp <= prev) break;
        const tranche = Math.min(baseImp, t.max) - prev;
        impot += tranche * t.taux;
        prev = t.max;
        if (!isFinite(t.max)) break;
    }
    return Math.round(impot);
}

export function calcAbattFamilial(iutsBrut: number, charges: number): number {
    const rules = getFiscalRules();
    const n = Math.min(Math.max(0, Math.round(charges)), 4);
    return Math.round(iutsBrut * (rules.abattFam[n] ?? 0));
}

export const EXO = { LOGEMENT: 75_000, TRANSPORT: 30_000, FONCTION: 50_000 };
export const CNSS_PLAFOND = 600_000;

export interface EmployeeInput {
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

export interface EmployeeCalcResult {
    remBrute: number;
    cotSoc: number;
    tpa: number;
    exoLog: number; exoTrans: number; exoFonct: number;
    tauxForf: number; abattForf: number;
    sni: number; baseImp: number;
    iutsBrut: number; abattFam: number; iutsNet: number;
    fsp: number;        // Fonds de Soutien Patriotique 1 %
    retPersonnel: number; // alias fsp : rétro-compat
    netAPayer: number;
    tauxEffectif: number;
}

export function calcEmploye(e: EmployeeInput): EmployeeCalcResult {
    const rules = getFiscalRules();
    const remBrute = e.salaire_base + e.anciennete + e.heures_sup +
        e.logement + e.transport + e.fonction;

    // CARFO (6 %) : plus proposé en UI ; conservé pour bulletins / employés existants
    const taux = e.cotisation === 'CARFO' ? 0.06 : rules.cnss.taux;
    const baseCot = Math.min(remBrute, rules.cnss.plafond);
    const cotSoc = Math.round(baseCot * taux);
    const tpa = Math.round(remBrute * rules.tpaRate);

    const exoLog = Math.min(e.logement, EXO.LOGEMENT);
    const exoTrans = Math.min(e.transport, EXO.TRANSPORT);
    const exoFonct = Math.min(e.fonction, EXO.FONCTION);

    const tauxForf = e.categorie === 'Cadre' ? 0.20 : 0.25;
    const abattForf = Math.round(e.salaire_base * tauxForf);

    const sni = remBrute - exoLog - exoTrans - exoFonct - cotSoc;
    const baseImp = Math.max(0, sni - abattForf);

    const iutsBrut = calcIUTS(baseImp);
    const abattFam = calcAbattFamilial(iutsBrut, e.charges);
    const iutsNet = Math.max(0, iutsBrut - abattFam);

    // FSP : Fonds de Soutien Patriotique (décret présidentiel BF 2023)
    // 1 % prélevé sur le salaire net (brute − IUTS − CNSS) de tout salarié BF
    const netAvantFSP = remBrute - iutsNet - cotSoc;
    const fsp = Math.round(netAvantFSP * 0.01);
    const retPersonnel = fsp; // alias rétro-compat
    const netAPayer = netAvantFSP - fsp;

    const tauxEffectif = remBrute > 0 ? (iutsNet / remBrute) * 100 : 0;

    return {
        remBrute, cotSoc, tpa,
        exoLog, exoTrans, exoFonct,
        tauxForf, abattForf,
        sni, baseImp,
        iutsBrut, abattFam, iutsNet,
        fsp, retPersonnel, netAPayer,
        tauxEffectif,
    };
}

// TVA
export function calcTVA(ht: number, taux?: number) {
    const rules = getFiscalRules();
    const t = taux ?? rules.tva.standardRate;
    const tva = Math.round(ht * t);
    return { ht, tva, ttc: ht + tva };
}

// IRF CGI 2025
export function calcIRF(loyerBrut: number) {
    const rules = getFiscalRules();
    const abatt = Math.round(loyerBrut * rules.irf.abattementBase);
    const base = loyerBrut - abatt;
    const seuil = rules.irf.tranche1Max;
    let irf1 = 0, irf2 = 0;
    if (base <= seuil) {
        irf1 = Math.round(base * rules.irf.tranche1Taux);
    } else {
        irf1 = Math.round(seuil * rules.irf.tranche1Taux);
        irf2 = Math.round((base - seuil) * rules.irf.tranche2Taux);
    }
    const irfTotal = irf1 + irf2;
    return {
        loyerBrut, abattement: abatt, baseNette: base,
        irf1, irf2, irfTotal, loyerNet: loyerBrut - irfTotal,
        tauxEffectif: loyerBrut > 0 ? (irfTotal / loyerBrut * 100).toFixed(2) : '0',
    };
}

// IRCM CGI 2025
const IRCM_TAUX: Record<string, number> = {
    CREANCES: 0.25, OBLIGATIONS: 0.06, DIVIDENDES: 0.125,
};
export function calcIRCM(brut: number, type: string) {
    const taux = IRCM_TAUX[type] ?? 0.25;
    const ircm = Math.round(brut * taux);
    return { brut, ircm, net: brut - ircm, taux };
}

// RAS CGI 2025
const RAS_TAUX: Record<string, number> = {
    RESIDENT_IFU: 0.05, RESIDENT_IFU_IMMO: 0.01, RESIDENT_SANS_IFU: 0.25,
    TRAVAIL_TEMPORAIRE: 0.02, NON_RESIDENT: 0.20, NON_RESIDENT_CEDEAO: 0.10,
    NONDETER_VACATION: 0.02, NONDETER_PUBLIC: 0.05, NONDETER_SALARIE: 0.10,
    COMMANDE_PUBLIQUE: 0.05, COMMANDE_PUB_BIENS: 0.01,
};
const RAS_NO_SEUIL = new Set([
    'NON_RESIDENT', 'NON_RESIDENT_CEDEAO', 'NONDETER_VACATION', 'NONDETER_PUBLIC', 'NONDETER_SALARIE',
]);
export function calcRAS(ht: number, typeKey: string) {
    const taux = RAS_TAUX[typeKey] ?? 0.05;
    const exonere = !RAS_NO_SEUIL.has(typeKey) && ht < 50_000;
    const ras = exonere ? 0 : Math.round(ht * taux);
    return { ht, ras, net: ht - ras, taux, exonere };
}

export const RAS_LABELS: Record<string, string> = {
    RESIDENT_IFU: 'Résident avec IFU (5 %)',
    RESIDENT_IFU_IMMO: 'Résident IFU : Immo/TP (1 %)',
    RESIDENT_SANS_IFU: 'Résident sans IFU (25 %)',
    TRAVAIL_TEMPORAIRE: 'Travail temporaire (2 %)',
    NON_RESIDENT: 'Non-résident (20 %)',
    NON_RESIDENT_CEDEAO: 'Non-résident CEDEAO Transport (10 %)',
    NONDETER_VACATION: 'Non-déterminé : vacation/manuel (2 %)',
    NONDETER_PUBLIC: 'Non-déterminé : entité publique (5 %)',
    NONDETER_SALARIE: 'Non-déterminé : salarié/intellectuel (10 %)',
    COMMANDE_PUBLIQUE: 'Commande publique (5 %)',
    COMMANDE_PUB_BIENS: 'Commande pub. : biens/TP (1 %)',
};

// CME CGI 2025 - Art. 533-542
// Plafond légal : CA ≤ 15 000 000 FCFA pour le régime CME.
// Au-delà, l'entreprise relève du RSI (IS/MFP, module distinct).
export const CME_CA_PLAFOND = 15_000_000;

const CME_TARIFS: Record<string, number[]> = {
    A: [200000, 160000, 120000, 80000, 60000, 30000, 20000, 10000],
    B: [160000, 120000, 80000, 60000, 42000, 20000, 12000, 6000],
    C: [120000, 80000, 54000, 42000, 30000, 12000, 9000, 2500],
    D: [80000, 48000, 30000, 18000, 14000, 6000, 3500, 2000],
};
const CME_TRANCHES = [
    { max: 1_500_000, classe: 8 }, { max: 3_000_000, classe: 7 }, { max: 5_000_000, classe: 6 },
    { max: 7_000_000, classe: 5 }, { max: 9_000_000, classe: 4 }, { max: 11_000_000, classe: 3 },
    { max: 13_000_000, classe: 2 }, { max: 15_000_000, classe: 1 },
];
export function calcCME(ca: number, zone: string, adhesionCGA: boolean) {
    if (ca > CME_CA_PLAFOND) return null; // hors régime CME → IS/MFP
    let classe = 1;
    for (const t of CME_TRANCHES) { if (ca <= t.max) { classe = t.classe; break; } }
    const tarifs = CME_TARIFS[zone] ?? CME_TARIFS.A;
    const cme = tarifs[classe - 1];
    return { ca, zone, classe, cme, cmeNet: adhesionCGA ? Math.round(cme * 0.75) : cme };
}

// Heures supplémentaires - Code du Travail BF Art. 151
// La semaine légale est de 40 h (173,33 h/mois standard).
// Majorations sur le taux horaire de base (salaire_base / 173,33) :
// - +25 % : heures normales supplémentaires (41e-48e heure)
// - +50 % : heures de nuit ou dimanche, ou au-delà de 48 h/semaine
// - +100 % : jours fériés légaux
export const HEURES_MOIS_STANDARD = 173.33;

export type TypeHeuresSup = 'normale' | 'nuit_dimanche' | 'ferie';

export function calcHeuresSup(
    salaireBase: number,
    nbHeures: number,
    type: TypeHeuresSup,
): { tauxHoraire: number; majoration: number; montantMaj: number; montantTotal: number } {
    const tauxHoraire = salaireBase / HEURES_MOIS_STANDARD;
    const majoration = type === 'ferie' ? 1.00 : type === 'nuit_dimanche' ? 0.50 : 0.25;
    const montantMaj = Math.round(tauxHoraire * nbHeures * majoration);
    const montantTotal = Math.round(tauxHoraire * nbHeures) + montantMaj;
    return { tauxHoraire: Math.round(tauxHoraire), majoration, montantMaj, montantTotal };
}

// IS / MFP CGI 2025
export function calcIS(benefice: number, adhesionCGA: boolean) {
    let is = Math.round(benefice * 0.275);
    if (adhesionCGA) is = Math.round(is * 0.70);
    return { benefice, is };
}
export function calcMFP(ca: number, regime: string, adhesionCGA: boolean) {
    const calc = Math.round(ca * 0.005);
    // 'RSI' = clé interne, 'simplifie' = valeur stockée depuis ISPage
    const minimum = (regime === 'RSI' || regime === 'simplifie') ? 300_000 : 1_000_000;
    let mfpDu = Math.max(calc, minimum);
    if (adhesionCGA) mfpDu = Math.round(mfpDu * 0.50);
    return { ca, mfpCalcule: calc, mfpMinimum: minimum, mfpDu };
}

// Patentes CGI 2025
const PATENTE_A = [
    { max: 5_000_000, droit: 10_000 }, { max: 7_000_000, droit: 15_000 },
    { max: 10_000_000, droit: 25_000 }, { max: 15_000_000, droit: 40_000 },
    { max: 20_000_000, droit: 60_000 }, { max: 30_000_000, droit: 85_000 },
    { max: 50_000_000, droit: 120_000 }, { max: 75_000_000, droit: 170_000 },
    { max: 100_000_000, droit: 220_000 }, { max: 150_000_000, droit: 280_000 },
    { max: 200_000_000, droit: 350_000 }, { max: 300_000_000, droit: 430_000 },
    { max: 500_000_000, droit: 530_000 }, { max: Infinity, droit: 660_000 },
];
export function calcPatente(ca: number, valeurLocative: number) {
    let droitFixe = 0;
    for (const t of PATENTE_A) { if (ca <= t.max) { droitFixe = t.droit; break; } }
    const droitProp = Math.round(valeurLocative * 0.01);
    return { ca, droitFixe, valeurLocative, droitProp, totalPatente: droitFixe + droitProp };
}

// Pénalités de retard CGI 2025 Art. 607
// Retourne le total des pénalités = majoration + intérêts moratoires,
// plafonné à 100 % du montant dû, avec un plancher minimum de 5 000 FCFA.
export function calcPenalite(montant: number, moisRetard: number): number {
    if (moisRetard <= 0 || montant <= 0) return 0;
    // Majoration : 10 % 1er mois + 3 % par mois supplémentaire, plafond 100 %
    const tauxMaj = Math.min(0.10 + (moisRetard - 1) * 0.03, 1.00);
    const majoration = Math.round(montant * tauxMaj);
    // Intérêts moratoires : 1 % par mois × nombre de mois
    const interets = Math.round(montant * 0.01 * moisRetard);
    let total = majoration + interets;
    // Plafond : ne peut pas dépasser 100 % du montant dû
    if (total > montant) total = Math.round(montant);
    // Plancher : minimum 5 000 FCFA
    if (total < 5_000) total = 5_000;
    return total;
}
