import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    calcCNSS,
    calcHTVA,
    calcIRF,
    calcRAS,
    calcSalarie,
    calcTPA,
    calcTVA18,
    uid,
} from './contribuableCalc';
import { getFiscalRules } from './fiscalRules';

export type SalarieRow = {
    id: string;
    nom: string;
    categorie: 'CADRE' | 'NON_CADRE';
    salaireB: number;
    charges: number;
    cnss: number;
    baseImp: number;
    iutsDu: number;
};

export type RsfonRow = {
    id: string;
    identite: string;
    ifu: string;
    localite: string;
    secteur: string;
    section: string;
    lot: string;
    parcelle: string;
    loyer: number;
    retenue: number;
};

export type RSLibRow = {
    id: string;
    ifu: string;
    identification: string;
    adresse: string;
    nature: string;
    date: string;
    montant: number;
    taux: number;
    retenue: number;
};

export type RSETRRow = {
    id: string;
    nom: string;
    activite: string;
    adresse: string;
    nature: string;
    date: string;
    montant: number;
    taux: number;
    retenue: number;
};

export type RSPRERow = {
    id: string;
    ifu: string;
    identification: string;
    adresse: string;
    nature: string;
    date: string;
    montant: number;
    taux: number;
    retenue: number;
};

export type RSTVARow = {
    id: string;
    ifu: string;
    identification: string;
    adresse: string;
    nature: string;
    date: string;
    montantTVA: number;
    taux: number;
    retenue: number;
};

export type TvaDeductibleRow = {
    id: string;
    type: string;
    ifu: string;
    nom: string;
    date: string;
    ref: string;
    ht: number;
    tvaFacturee: number;
    tvaDed: number;
};

export type TvaAvanceRow = {
    id: string;
    ifu: string;
    nom: string;
    adresse: string;
    source: string;
    refMarche: string;
    nature: string;
    ttc: number;
    htva: number;
    cumulHTVA: number;
};

export type PrelRow = {
    id: string;
    nom: string;
    ifu: string;
    date: string;
    montantHT: number;
    base: number;
    prelevement: number;
};

const TVA_TYPES_DEFAULT = 'BAIS / Achats locaux (biens et marchandises)';
const DATE_DMY_RE = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;

function cleanText(v: unknown): string {
    return String(v ?? '');
}

function sanitizeIfu(v: unknown): string {
    return String(v ?? '').toUpperCase();
}

function cleanDateDMY(v: unknown): string {
    const raw = String(v ?? '');
    if (!raw) return '';
    if (DATE_DMY_RE.test(raw.trim())) return raw.trim();
    return raw;
}

function n0(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function clampCharges(v: unknown): number {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(4, Math.round(n)));
}

function normalizeTaux(value: unknown, allowed: readonly { v: number }[], fallback: number): number {
    const n = Number(value);
    return allowed.some((t) => t.v === n) ? n : fallback;
}

function emptySalarie(): SalarieRow {
    const { cnss, baseImp, iutsDu } = calcSalarie(0, 'NON_CADRE', 0, new Date().getFullYear());
    return {
        id: uid(),
        nom: '',
        categorie: 'NON_CADRE',
        salaireB: 0,
        charges: 0,
        cnss,
        baseImp,
        iutsDu,
    };
}

function emptyRsfon(): RsfonRow {
    return {
        id: uid(),
        identite: '',
        ifu: '',
        localite: '',
        secteur: '',
        section: '',
        lot: '',
        parcelle: '',
        loyer: 0,
        retenue: 0,
    };
}

function emptyRSLib(year: number): RSLibRow {
    const rules = getFiscalRules(year);
    return {
        id: uid(),
        ifu: '',
        identification: '',
        adresse: '',
        nature: '',
        date: '',
        montant: 0,
        taux: rules.ras.rslib[0].v,
        retenue: 0,
    };
}

function emptyRSETR(year: number): RSETRRow {
    const rules = getFiscalRules(year);
    return {
        id: uid(),
        nom: '',
        activite: '',
        adresse: '',
        nature: '',
        date: '',
        montant: 0,
        taux: rules.ras.rsetr[0].v,
        retenue: 0,
    };
}

function emptyRSPRE(year: number): RSPRERow {
    const rules = getFiscalRules(year);
    return {
        id: uid(),
        ifu: '',
        identification: '',
        adresse: '',
        nature: '',
        date: '',
        montant: 0,
        taux: rules.ras.rspre[0].v,
        retenue: 0,
    };
}

function emptyRSTVA(year: number): RSTVARow {
    const rules = getFiscalRules(year);
    return {
        id: uid(),
        ifu: '',
        identification: '',
        adresse: '',
        nature: '',
        date: '',
        montantTVA: 0,
        taux: rules.ras.rstva[0].v,
        retenue: 0,
    };
}

function emptyTvaDed(): TvaDeductibleRow {
    const ht = 0;
    const tvaFacturee = calcTVA18(ht, new Date().getFullYear());
    return {
        id: uid(),
        type: TVA_TYPES_DEFAULT,
        ifu: '',
        nom: '',
        date: '',
        ref: '',
        ht,
        tvaFacturee,
        tvaDed: tvaFacturee,
    };
}

function emptyTvaAv(): TvaAvanceRow {
    return {
        id: uid(),
        ifu: '',
        nom: '',
        adresse: '',
        source: '',
        refMarche: '',
        nature: '',
        ttc: 0,
        htva: 0,
        cumulHTVA: 0,
    };
}

function emptyPrel(): PrelRow {
    return { id: uid(), nom: '', ifu: '', date: '', montantHT: 0, base: 0, prelevement: 0 };
}

export type ContribuableState = {
    scopeUserId: string;
    scopeCompanyId: string;
    company: { ifu: string; raisonSociale: string; rc: string; adresse: string; telephone: string };
    period: { year: number; month: number };
    annexes: {
        iuts: { rows: SalarieRow[] };
        rsfon: { rows: RsfonRow[] };
        rslib: { rows: RSLibRow[] };
        rsetr: { rows: RSETRRow[] };
        rspre: { rows: RSPRERow[] };
        rstva: { rows: RSTVARow[] };
        tva: { deductible: TvaDeductibleRow[]; avances: TvaAvanceRow[] };
        prel: { rows: PrelRow[] };
    };
    setCompany: (c: Partial<ContribuableState['company']>) => void;
    setPeriod: (p: Partial<ContribuableState['period']>) => void;
    addIutsRow: () => void;
    updateIutsRow: (id: string, patch: Partial<SalarieRow>) => void;
    removeIutsRow: (id: string) => void;
    addRsfonRow: () => void;
    updateRsfonRow: (id: string, patch: Partial<RsfonRow>) => void;
    removeRsfonRow: (id: string) => void;
    addRSLibRow: () => void;
    updateRSLibRow: (id: string, patch: Partial<RSLibRow>) => void;
    removeRSLibRow: (id: string) => void;
    addRSETRRow: () => void;
    updateRSETRRow: (id: string, patch: Partial<RSETRRow>) => void;
    removeRSETRRow: (id: string) => void;
    addRSPRERow: () => void;
    updateRSPRERow: (id: string, patch: Partial<RSPRERow>) => void;
    removeRSPRERow: (id: string) => void;
    addRSTVARow: () => void;
    updateRSTVARow: (id: string, patch: Partial<RSTVARow>) => void;
    removeRSTVARow: (id: string) => void;
    addTvaDeductible: () => void;
    updateTvaDeductible: (id: string, patch: Partial<TvaDeductibleRow>) => void;
    removeTvaDeductible: (id: string) => void;
    addTvaAvance: () => void;
    updateTvaAvance: (id: string, patch: Partial<TvaAvanceRow>) => void;
    removeTvaAvance: (id: string) => void;
    addPrelRow: () => void;
    updatePrelRow: (id: string, patch: Partial<PrelRow>) => void;
    removePrelRow: (id: string) => void;
    resetAllContribuable: () => void;
    ensureScope: (userId: string, companyId: string) => void;
    loadFromServerState: (state: Partial<Pick<ContribuableState, 'company' | 'period' | 'annexes'>>) => void;
    toServerState: () => Pick<ContribuableState, 'company' | 'period' | 'annexes'>;
    rowCount: (code: AnnexNavCode) => number;
};

export type AnnexNavCode =
    | 'generer'
    | 'iuts'
    | 'ros'
    | 'tpa'
    | 'rsfon'
    | 'rslib'
    | 'rsetr'
    | 'rspre'
    | 'rstva'
    | 'tva'
    | 'prel';

const defaultCompany = { ifu: '', raisonSociale: '', rc: '', adresse: '', telephone: '' };

const initialAnnexes = () => ({
    iuts: { rows: [] as SalarieRow[] },
    rsfon: { rows: [] as RsfonRow[] },
    rslib: { rows: [] as RSLibRow[] },
    rsetr: { rows: [] as RSETRRow[] },
    rspre: { rows: [] as RSPRERow[] },
    rstva: { rows: [] as RSTVARow[] },
    tva: { deductible: [] as TvaDeductibleRow[], avances: [] as TvaAvanceRow[] },
    prel: { rows: [] as PrelRow[] },
});

export const useContribuableStore = create<ContribuableState>()(
    persist(
        (set, get) => ({
            scopeUserId: '',
            scopeCompanyId: '',
            company: { ...defaultCompany },
            period: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
            annexes: initialAnnexes(),
            setCompany: (c) => set((s) => ({ company: { ...s.company, ...c } })),
            setPeriod: (p) =>
                set((s) => {
                    const year = p.year ?? s.period.year;
                    const rules = getFiscalRules(year);
                    const rslibAllowed = rules.ras.rslib.map((x) => x.v);
                    const rsetrAllowed = rules.ras.rsetr.map((x) => x.v);
                    const rspreAllowed = rules.ras.rspre.map((x) => x.v);
                    const rstvaAllowed = rules.ras.rstva.map((x) => x.v);
                    const normalizeRate = (value: number, allowed: number[], fallback: number) =>
                        allowed.includes(value) ? value : fallback;

                    const iutsRows = s.annexes.iuts.rows.map((row) => {
                        const { cnss, baseImp, iutsDu } = calcSalarie(row.salaireB, row.categorie, row.charges, year);
                        return { ...row, cnss, baseImp, iutsDu };
                    });
                    const rsfonRows = s.annexes.rsfon.rows.map((row) => ({
                        ...row,
                        retenue: calcIRF(row.loyer, year).retenue,
                    }));
                    const rslibRows = s.annexes.rslib.rows.map((row) => {
                        const taux = normalizeRate(row.taux, rslibAllowed, rules.ras.rslib[0].v);
                        return { ...row, taux, retenue: calcRAS(row.montant, taux) };
                    });
                    const rsetrRows = s.annexes.rsetr.rows.map((row) => {
                        const taux = normalizeRate(row.taux, rsetrAllowed, rules.ras.rsetr[0].v);
                        return { ...row, taux, retenue: calcRAS(row.montant, taux) };
                    });
                    const rspreRows = s.annexes.rspre.rows.map((row) => {
                        const taux = normalizeRate(row.taux, rspreAllowed, rules.ras.rspre[0].v);
                        return { ...row, taux, retenue: calcRAS(row.montant, taux) };
                    });
                    const rstvaRows = s.annexes.rstva.rows.map((row) => {
                        const taux = normalizeRate(row.taux, rstvaAllowed, rules.ras.rstva[0].v);
                        return { ...row, taux, retenue: calcRAS(row.montantTVA, taux) };
                    });
                    const tvaDedRows = s.annexes.tva.deductible.map((row) => {
                        const tvaFacturee = calcTVA18(row.ht, year);
                        return { ...row, tvaFacturee, tvaDed: Math.min(row.tvaDed, tvaFacturee) };
                    });
                    const tvaAvRows = s.annexes.tva.avances.map((row) => {
                        const htva = calcHTVA(row.ttc, year);
                        return { ...row, htva, cumulHTVA: Math.max(row.cumulHTVA, htva) };
                    });
                    return {
                        period: { ...s.period, ...p },
                        annexes: {
                            ...s.annexes,
                            iuts: { rows: iutsRows },
                            rsfon: { rows: rsfonRows },
                            rslib: { rows: rslibRows },
                            rsetr: { rows: rsetrRows },
                            rspre: { rows: rspreRows },
                            rstva: { rows: rstvaRows },
                            tva: { deductible: tvaDedRows, avances: tvaAvRows },
                        },
                    };
                }),
            addIutsRow: () =>
                set((s) => ({
                    annexes: { ...s.annexes, iuts: { rows: [...s.annexes.iuts.rows, emptySalarie()] } },
                })),
            updateIutsRow: (id, patch) =>
                set((s) => {
                    const rows = s.annexes.iuts.rows.map((row) => {
                        if (row.id !== id) return row;
                        const next = { ...row, ...patch };
                        const sb = n0(next.salaireB);
                        const ch = clampCharges(next.charges);
                        const categorie = next.categorie === 'CADRE' ? 'CADRE' : 'NON_CADRE';
                        const { cnss, baseImp, iutsDu } = calcSalarie(sb, categorie, ch, s.period.year);
                        return {
                            ...next,
                            nom: cleanText(next.nom),
                            categorie,
                            salaireB: sb,
                            charges: ch,
                            cnss,
                            baseImp,
                            iutsDu,
                        };
                    });
                    return { annexes: { ...s.annexes, iuts: { rows } } };
                }),
            removeIutsRow: (id) =>
                set((s) => ({
                    annexes: {
                        ...s.annexes,
                        iuts: { rows: s.annexes.iuts.rows.filter((r) => r.id !== id) },
                    },
                })),
            addRsfonRow: () =>
                set((s) => ({
                    annexes: { ...s.annexes, rsfon: { rows: [...s.annexes.rsfon.rows, emptyRsfon()] } },
                })),
            updateRsfonRow: (id, patch) =>
                set((s) => {
                    const rows = s.annexes.rsfon.rows.map((row) => {
                        if (row.id !== id) return row;
                        const next = { ...row, ...patch };
                        const loyer = n0(next.loyer);
                        const { retenue } = calcIRF(loyer, s.period.year);
                        return {
                            ...next,
                            identite: cleanText(next.identite),
                            ifu: sanitizeIfu(next.ifu),
                            localite: cleanText(next.localite),
                            secteur: cleanText(next.secteur),
                            section: cleanText(next.section),
                            lot: cleanText(next.lot),
                            parcelle: cleanText(next.parcelle),
                            loyer,
                            retenue,
                        };
                    });
                    return { annexes: { ...s.annexes, rsfon: { rows } } };
                }),
            removeRsfonRow: (id) =>
                set((s) => ({
                    annexes: {
                        ...s.annexes,
                        rsfon: { rows: s.annexes.rsfon.rows.filter((r) => r.id !== id) },
                    },
                })),
            addRSLibRow: () =>
                set((s) => ({
                    annexes: { ...s.annexes, rslib: { rows: [...s.annexes.rslib.rows, emptyRSLib(s.period.year)] } },
                })),
            updateRSLibRow: (id, patch) =>
                set((s) => {
                    const options = getRSLIBTaux(s.period.year);
                    const rows = s.annexes.rslib.rows.map((row) => {
                        if (row.id !== id) return row;
                        const next = { ...row, ...patch };
                        const montant = n0(next.montant);
                        const taux = normalizeTaux(next.taux, options, options[0].v);
                        return {
                            ...next,
                            ifu: sanitizeIfu(next.ifu),
                            identification: cleanText(next.identification),
                            adresse: cleanText(next.adresse),
                            nature: cleanText(next.nature),
                            date: cleanDateDMY(next.date),
                            montant,
                            taux,
                            retenue: calcRAS(montant, taux),
                        };
                    });
                    return { annexes: { ...s.annexes, rslib: { rows } } };
                }),
            removeRSLibRow: (id) =>
                set((s) => ({
                    annexes: {
                        ...s.annexes,
                        rslib: { rows: s.annexes.rslib.rows.filter((r) => r.id !== id) },
                    },
                })),
            addRSETRRow: () =>
                set((s) => ({
                    annexes: { ...s.annexes, rsetr: { rows: [...s.annexes.rsetr.rows, emptyRSETR(s.period.year)] } },
                })),
            updateRSETRRow: (id, patch) =>
                set((s) => {
                    const options = getRSETRTaux(s.period.year);
                    const rows = s.annexes.rsetr.rows.map((row) => {
                        if (row.id !== id) return row;
                        const next = { ...row, ...patch };
                        const montant = n0(next.montant);
                        const taux = normalizeTaux(next.taux, options, options[0].v);
                        return {
                            ...next,
                            nom: cleanText(next.nom),
                            activite: cleanText(next.activite),
                            adresse: cleanText(next.adresse),
                            nature: cleanText(next.nature),
                            date: cleanDateDMY(next.date),
                            montant,
                            taux,
                            retenue: calcRAS(montant, taux),
                        };
                    });
                    return { annexes: { ...s.annexes, rsetr: { rows } } };
                }),
            removeRSETRRow: (id) =>
                set((s) => ({
                    annexes: {
                        ...s.annexes,
                        rsetr: { rows: s.annexes.rsetr.rows.filter((r) => r.id !== id) },
                    },
                })),
            addRSPRERow: () =>
                set((s) => ({
                    annexes: { ...s.annexes, rspre: { rows: [...s.annexes.rspre.rows, emptyRSPRE(s.period.year)] } },
                })),
            updateRSPRERow: (id, patch) =>
                set((s) => {
                    const options = getRSPRETaux(s.period.year);
                    const rows = s.annexes.rspre.rows.map((row) => {
                        if (row.id !== id) return row;
                        const next = { ...row, ...patch };
                        const montant = n0(next.montant);
                        const taux = normalizeTaux(next.taux, options, options[0].v);
                        return {
                            ...next,
                            ifu: sanitizeIfu(next.ifu),
                            identification: cleanText(next.identification),
                            adresse: cleanText(next.adresse),
                            nature: cleanText(next.nature),
                            date: cleanDateDMY(next.date),
                            montant,
                            taux,
                            retenue: calcRAS(montant, taux),
                        };
                    });
                    return { annexes: { ...s.annexes, rspre: { rows } } };
                }),
            removeRSPRERow: (id) =>
                set((s) => ({
                    annexes: {
                        ...s.annexes,
                        rspre: { rows: s.annexes.rspre.rows.filter((r) => r.id !== id) },
                    },
                })),
            addRSTVARow: () =>
                set((s) => ({
                    annexes: { ...s.annexes, rstva: { rows: [...s.annexes.rstva.rows, emptyRSTVA(s.period.year)] } },
                })),
            updateRSTVARow: (id, patch) =>
                set((s) => {
                    const options = getRSTVATaux(s.period.year);
                    const rows = s.annexes.rstva.rows.map((row) => {
                        if (row.id !== id) return row;
                        const next = { ...row, ...patch };
                        const montantTVA = n0(next.montantTVA);
                        const taux = normalizeTaux(next.taux, options, options[0].v);
                        return {
                            ...next,
                            ifu: sanitizeIfu(next.ifu),
                            identification: cleanText(next.identification),
                            adresse: cleanText(next.adresse),
                            nature: cleanText(next.nature),
                            date: cleanDateDMY(next.date),
                            montantTVA,
                            taux,
                            retenue: calcRAS(montantTVA, taux),
                        };
                    });
                    return { annexes: { ...s.annexes, rstva: { rows } } };
                }),
            removeRSTVARow: (id) =>
                set((s) => ({
                    annexes: {
                        ...s.annexes,
                        rstva: { rows: s.annexes.rstva.rows.filter((r) => r.id !== id) },
                    },
                })),
            addTvaDeductible: () =>
                set((s) => ({
                    annexes: {
                        ...s.annexes,
                        tva: {
                            ...s.annexes.tva,
                            deductible: [...s.annexes.tva.deductible, emptyTvaDed()],
                        },
                    },
                })),
            updateTvaDeductible: (id, patch) =>
                set((s) => {
                    const deductible = s.annexes.tva.deductible.map((row) => {
                        if (row.id !== id) return row;
                        const next = { ...row, ...patch };
                        const ht = n0(next.ht);
                        const tvaFacturee = calcTVA18(ht, s.period.year);
                        let tvaDed = next.tvaDed;
                        if (patch.ht !== undefined && patch.tvaDed === undefined) {
                            tvaDed = tvaFacturee;
                        }
                        return {
                            ...next,
                            type: cleanText(next.type) || TVA_TYPES_DEFAULT,
                            ifu: sanitizeIfu(next.ifu),
                            nom: cleanText(next.nom),
                            date: cleanDateDMY(next.date),
                            ref: cleanText(next.ref),
                            ht,
                            tvaFacturee,
                            tvaDed: Math.min(n0(tvaDed), tvaFacturee),
                        };
                    });
                    return { annexes: { ...s.annexes, tva: { ...s.annexes.tva, deductible } } };
                }),
            removeTvaDeductible: (id) =>
                set((s) => ({
                    annexes: {
                        ...s.annexes,
                        tva: {
                            ...s.annexes.tva,
                            deductible: s.annexes.tva.deductible.filter((r) => r.id !== id),
                        },
                    },
                })),
            addTvaAvance: () =>
                set((s) => ({
                    annexes: {
                        ...s.annexes,
                        tva: {
                            ...s.annexes.tva,
                            avances: [...s.annexes.tva.avances, emptyTvaAv()],
                        },
                    },
                })),
            updateTvaAvance: (id, patch) =>
                set((s) => {
                    const avances = s.annexes.tva.avances.map((row) => {
                        if (row.id !== id) return row;
                        const next = { ...row, ...patch };
                        const ttc = n0(next.ttc);
                        const htva = calcHTVA(ttc, s.period.year);
                        const cumulHTVA =
                            patch.cumulHTVA !== undefined ? n0(next.cumulHTVA) : next.cumulHTVA ?? htva;
                        return {
                            ...next,
                            ifu: sanitizeIfu(next.ifu),
                            nom: cleanText(next.nom),
                            adresse: cleanText(next.adresse),
                            source: cleanText(next.source),
                            refMarche: cleanText(next.refMarche),
                            nature: cleanText(next.nature),
                            ttc,
                            htva,
                            cumulHTVA: Math.max(cumulHTVA, htva),
                        };
                    });
                    return { annexes: { ...s.annexes, tva: { ...s.annexes.tva, avances } } };
                }),
            removeTvaAvance: (id) =>
                set((s) => ({
                    annexes: {
                        ...s.annexes,
                        tva: {
                            ...s.annexes.tva,
                            avances: s.annexes.tva.avances.filter((r) => r.id !== id),
                        },
                    },
                })),
            addPrelRow: () =>
                set((s) => ({
                    annexes: { ...s.annexes, prel: { rows: [...s.annexes.prel.rows, emptyPrel()] } },
                })),
            updatePrelRow: (id, patch) =>
                set((s) => ({
                    annexes: {
                        ...s.annexes,
                        prel: {
                            rows: s.annexes.prel.rows.map((row) => {
                                if (row.id !== id) return row;
                                const next = { ...row, ...patch };
                                const montantHT = n0(next.montantHT);
                                const base = Math.min(n0(next.base), montantHT);
                                const prelevement = n0(next.prelevement);
                                return {
                                    ...next,
                                    nom: cleanText(next.nom),
                                    ifu: sanitizeIfu(next.ifu),
                                    date: cleanDateDMY(next.date),
                                    montantHT,
                                    base,
                                    prelevement: Math.min(prelevement, base),
                                };
                            }),
                        },
                    },
                })),
            removePrelRow: (id) =>
                set((s) => ({
                    annexes: {
                        ...s.annexes,
                        prel: { rows: s.annexes.prel.rows.filter((r) => r.id !== id) },
                    },
                })),
            /** Efface annexes + période ; l’identité entreprise reste (rechargée depuis l’API côté UI). */
            resetAllContribuable: () =>
                set((s) => ({
                    scopeUserId: s.scopeUserId,
                    scopeCompanyId: s.scopeCompanyId,
                    company: s.company,
                    period: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
                    annexes: initialAnnexes(),
                })),
            ensureScope: (userId, companyId) =>
                set((s) => {
                    const nextUser = String(userId ?? '').trim();
                    const nextCompany = String(companyId ?? '').trim();
                    if (!nextUser || !nextCompany) return s;
                    if (s.scopeUserId === nextUser && s.scopeCompanyId === nextCompany) return s;
                    return {
                        scopeUserId: nextUser,
                        scopeCompanyId: nextCompany,
                        company: { ...defaultCompany },
                        period: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
                        annexes: initialAnnexes(),
                    };
                }),
            loadFromServerState: (state) =>
                set(() => ({
                    company: { ...defaultCompany, ...(state.company ?? {}) },
                    period: {
                        year: Number(state.period?.year) || new Date().getFullYear(),
                        month: Number(state.period?.month) || new Date().getMonth() + 1,
                    },
                    annexes: (state.annexes as ContribuableState['annexes']) ?? initialAnnexes(),
                })),
            toServerState: () => {
                const s = get();
                return {
                    company: s.company,
                    period: s.period,
                    annexes: s.annexes,
                };
            },
            rowCount: (code) => {
                const st = get();
                if (code === 'ros' || code === 'tpa') return st.annexes.iuts.rows.length;
                if (code === 'tva')
                    return st.annexes.tva.deductible.length + st.annexes.tva.avances.length;
                if (code === 'generer') return 0;
                const a = st.annexes[code as keyof typeof st.annexes];
                if (a && 'rows' in a) return (a as { rows: unknown[] }).rows.length;
                return 0;
            },
        }),
        { name: 'fisca-contribuable-v2' }
    )
);

export function formatFc(n: number): string {
    return Number(Math.round(+n || 0)).toLocaleString('fr-FR');
}

export const TVA_TYPE_OPTIONS = [
    'BAIS / Importation',
    'BAIS / Achats locaux (biens et marchandises)',
    'BAIS / Achats locaux (services et frais généraux)',
    'Immobilisations / Achats locaux',
    'Immobilisations / Importation',
] as const;

const DEFAULT_RULES = getFiscalRules(new Date().getFullYear());
export const RSLIB_TAUX = DEFAULT_RULES.ras.rslib;
export const RSETR_TAUX = DEFAULT_RULES.ras.rsetr;
export const RSPRE_TAUX = DEFAULT_RULES.ras.rspre;
export const RSTVA_TAUX = DEFAULT_RULES.ras.rstva;

export function getRSLIBTaux(year: number) {
    return getFiscalRules(year).ras.rslib;
}
export function getRSETRTaux(year: number) {
    return getFiscalRules(year).ras.rsetr;
}
export function getRSPRETaux(year: number) {
    return getFiscalRules(year).ras.rspre;
}
export function getRSTVATaux(year: number) {
    return getFiscalRules(year).ras.rstva;
}

export function totalTPA(rows: SalarieRow[], year?: number): number {
    return rows.reduce((s, r) => s + calcTPA(r.salaireB, year), 0);
}
