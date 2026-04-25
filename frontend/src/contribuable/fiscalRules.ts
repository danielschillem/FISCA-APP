export type RasRateOption = { v: number; l: string };

export type FiscalRules = {
    year: number;
    iutsTranches: { max: number; taux: number }[];
    abattFam: Record<number, number>;
    cnss: { plafond: number; taux: number };
    cnssPatronal: { famille: number; accident: number; retraite: number; carfo: number };
    abattForfait: { CADRE: number; NON_CADRE: number };
    tpaRate: number;
    irf: { abattementBase: number; tranche1Max: number; tranche1Taux: number; tranche2Taux: number };
    tva: { standardRate: number };
    ras: {
        rslib: RasRateOption[];
        rsetr: RasRateOption[];
        rspre: RasRateOption[];
        rstva: RasRateOption[];
    };
};

const RULES_BY_YEAR: Record<number, FiscalRules> = {
    2025: {
        year: 2025,
        iutsTranches: [
            { max: 30_000, taux: 0.0 },
            { max: 50_000, taux: 0.121 },
            { max: 80_000, taux: 0.139 },
            { max: 120_000, taux: 0.157 },
            { max: 170_000, taux: 0.184 },
            { max: 250_000, taux: 0.217 },
            { max: Infinity, taux: 0.25 },
        ],
        abattFam: { 0: 0, 1: 0.08, 2: 0.1, 3: 0.12, 4: 0.14 },
        cnss: { plafond: 600_000, taux: 0.055 },
        cnssPatronal: { famille: 0.072, accident: 0.034, retraite: 0.055, carfo: 0.07 },
        abattForfait: { CADRE: 0.2, NON_CADRE: 0.25 },
        tpaRate: 0.03,
        irf: { abattementBase: 0.5, tranche1Max: 100_000, tranche1Taux: 0.18, tranche2Taux: 0.25 },
        tva: { standardRate: 0.18 },
        ras: {
            rslib: [
                { v: 0.02, l: '2% — Vacation/Manuel' },
                { v: 0.05, l: '5% — Entité publique' },
                { v: 0.1, l: '10% — Salarié/Intellectuel' },
            ],
            rsetr: [
                { v: 0.2, l: '20% — Non-résident général' },
                { v: 0.1, l: '10% — Transport CEDEAO' },
            ],
            rspre: [
                { v: 0.01, l: '1% — Immobilier/TP' },
                { v: 0.02, l: '2% — Travail temporaire' },
                { v: 0.05, l: '5% — Avec IFU' },
                { v: 0.25, l: '25% — Sans IFU' },
            ],
            rstva: [
                { v: 0.2, l: '20%' },
                { v: 0.3, l: '30%' },
            ],
        },
    },
    // Placeholder: same rules as 2025 until legal update.
    2026: {} as FiscalRules,
};

RULES_BY_YEAR[2026] = { ...RULES_BY_YEAR[2025], year: 2026 };

export function getFiscalRules(year?: number): FiscalRules {
    const y = year ?? new Date().getFullYear();
    if (RULES_BY_YEAR[y]) return RULES_BY_YEAR[y];
    const years = Object.keys(RULES_BY_YEAR)
        .map(Number)
        .sort((a, b) => a - b);
    const fallback = years.filter((v) => v <= y).pop() ?? years[0];
    return RULES_BY_YEAR[fallback];
}

