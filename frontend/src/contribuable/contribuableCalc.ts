/** Moteur aligné sur le prototype `calc.js` (CGI 2025 BF) */
import { getFiscalRules } from './fiscalRules';

export function calcIUTSBrut(base: number, year?: number): number {
    const rules = getFiscalRules(year);
    let impot = 0;
    let prev = 0;
    for (const t of rules.iutsTranches) {
        if (base <= prev) break;
        impot += (Math.min(base, t.max) - prev) * t.taux;
        prev = t.max;
    }
    return Math.round(impot);
}

export function calcIUTSNet(baseImposable: number, charges: number, year?: number): number {
    const rules = getFiscalRules(year);
    const n = Math.max(0, Math.min(4, Math.round(charges) || 0));
    const brut = calcIUTSBrut(+baseImposable || 0, year);
    const abat = Math.round(brut * (rules.abattFam[n] ?? 0));
    return Math.max(0, brut - abat);
}

export function calcCNSS(salaireB: number, year?: number): number {
    const rules = getFiscalRules(year);
    return Math.round(Math.min(+salaireB || 0, rules.cnss.plafond) * rules.cnss.taux);
}

export function calcCNSSPatronale(salaireB: number, year?: number, regime: 'CNSS' | 'CARFO' = 'CNSS'): number {
    const rules = getFiscalRules(year);
    const base = Math.min(+salaireB || 0, rules.cnss.plafond);
    if (regime === 'CARFO') return Math.round(base * rules.cnssPatronal.carfo);
    const taux =
        rules.cnssPatronal.famille + rules.cnssPatronal.accident + rules.cnssPatronal.retraite;
    return Math.round(base * taux);
}

export function calcBaseImposable(salaireB: number, categorie: string, year?: number): number {
    const rules = getFiscalRules(year);
    const brut = +salaireB || 0;
    const cnss = calcCNSS(brut, year);
    const taux = rules.abattForfait[categorie as 'CADRE' | 'NON_CADRE'] ?? rules.abattForfait.NON_CADRE;
    return Math.round((brut - cnss) * (1 - taux));
}

export function calcSalarie(salaireB: number, categorie: string, charges: number, year?: number) {
    const cnss = calcCNSS(salaireB, year);
    const baseImp = calcBaseImposable(salaireB, categorie, year);
    const iutsDu = calcIUTSNet(baseImp, charges, year);
    return { cnss, baseImp, iutsDu };
}

export function calcTPA(salaireB: number, year?: number): number {
    const rules = getFiscalRules(year);
    return Math.round((+salaireB || 0) * rules.tpaRate);
}

// Fonds de Soutien Patriotique (FSP): 1% sur le net salarial avant FSP.
export function calcFSP(salaireB: number, cnss: number, iuts: number): number {
    const netAvantFsp = Math.max(0, (+salaireB || 0) - (+cnss || 0) - (+iuts || 0));
    return Math.round(netAvantFsp * 0.01);
}

export function calcIRF(montantLoyer: number, year?: number) {
    const rules = getFiscalRules(year);
    const l = +montantLoyer || 0;
    const base = Math.round(l * rules.irf.abattementBase);
    const t1 = Math.round(Math.min(base, rules.irf.tranche1Max) * rules.irf.tranche1Taux);
    const t2 = Math.round(Math.max(0, base - rules.irf.tranche1Max) * rules.irf.tranche2Taux);
    return { base, retenue: t1 + t2 };
}

export function calcRAS(montant: number, taux: number): number {
    return Math.round((+montant || 0) * (+taux || 0));
}

export function calcTVA18(ht: number, year?: number): number {
    const rules = getFiscalRules(year);
    return Math.round((+ht || 0) * rules.tva.standardRate);
}

export function calcHTVA(ttc: number, year?: number): number {
    const rules = getFiscalRules(year);
    return Math.round((+ttc || 0) / (1 + rules.tva.standardRate));
}

export function fc(n: number): string {
    return Number(Math.round(+n || 0)).toLocaleString('fr-FR');
}

let seq = 0;
export function uid(): string {
    return String(++seq);
}
