import { beforeEach, describe, expect, it } from 'vitest';
import { calcHTVA, calcIRF, calcSalarie, calcTVA18 } from './contribuableCalc';
import { useContribuableStore } from './contribuableStore';

const STORAGE_KEY = 'fisca-contribuable-v2';

const memoryStorage = (() => {
    const map = new Map<string, string>();
    return {
        getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
        setItem: (k: string, v: string) => {
            map.set(k, String(v));
        },
        removeItem: (k: string) => {
            map.delete(k);
        },
        clear: () => {
            map.clear();
        },
        key: (index: number) => Array.from(map.keys())[index] ?? null,
        get length() {
            return map.size;
        },
    };
})();

Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    writable: true,
});

function resetStore() {
    useContribuableStore.setState({
        company: { ifu: '', raisonSociale: '', rc: '', adresse: '', telephone: '' },
        period: { year: 2025, month: 1 },
        annexes: {
            iuts: { rows: [] },
            rsfon: { rows: [] },
            rslib: { rows: [] },
            rsetr: { rows: [] },
            rspre: { rows: [] },
            rstva: { rows: [] },
            tva: { deductible: [], avances: [] },
            prel: { rows: [] },
        },
    });
}

describe('useContribuableStore - period/year recalculation', () => {
    beforeEach(() => {
        localStorage.removeItem(STORAGE_KEY);
        resetStore();
    });

    it('recalculates IUTS/CNSS fields when period year changes', () => {
        useContribuableStore.setState((s) => ({
            ...s,
            annexes: {
                ...s.annexes,
                iuts: {
                    rows: [
                        {
                            id: 'i1',
                            nom: 'Nom Prenom',
                            categorie: 'NON_CADRE',
                            salaireB: 200_000,
                            charges: 2,
                            ...calcSalarie(200_000, 'NON_CADRE', 2, 2025),
                        },
                    ],
                },
            },
        }));

        useContribuableStore.getState().setPeriod({ year: 2026 });
        const row = useContribuableStore.getState().annexes.iuts.rows[0];
        const expected = calcSalarie(200_000, 'NON_CADRE', 2, 2026);
        expect(row.cnss).toBe(expected.cnss);
        expect(row.baseImp).toBe(expected.baseImp);
        expect(row.iutsDu).toBe(expected.iutsDu);
    });

    it('recomputes TVA rows with year rules and keeps constraints', () => {
        useContribuableStore.setState((s) => ({
            ...s,
            annexes: {
                ...s.annexes,
                tva: {
                    deductible: [
                        {
                            id: 'd1',
                            type: 'BAIS / Achats locaux (biens et marchandises)',
                            ifu: '1234567890AB',
                            nom: 'Fournisseur',
                            date: '01/01/2025',
                            ref: 'FACT-1',
                            ht: 100_000,
                            tvaFacturee: 18_000,
                            tvaDed: 999_999,
                        },
                    ],
                    avances: [
                        {
                            id: 'a1',
                            ifu: '1234567890AB',
                            nom: 'Client',
                            adresse: '',
                            source: '',
                            refMarche: '',
                            nature: '',
                            ttc: 118_000,
                            htva: 10_000,
                            cumulHTVA: 5_000,
                        },
                    ],
                },
            },
        }));

        useContribuableStore.getState().setPeriod({ year: 2026 });
        const st = useContribuableStore.getState();
        const ded = st.annexes.tva.deductible[0];
        const av = st.annexes.tva.avances[0];

        expect(ded.tvaFacturee).toBe(calcTVA18(100_000, 2026));
        expect(ded.tvaDed).toBe(ded.tvaFacturee);
        expect(av.htva).toBe(calcHTVA(118_000, 2026));
        expect(av.cumulHTVA).toBeGreaterThanOrEqual(av.htva);
    });

    it('normalizes invalid RAS rate on setPeriod', () => {
        useContribuableStore.setState((s) => ({
            ...s,
            annexes: {
                ...s.annexes,
                rslib: {
                    rows: [
                        {
                            id: 'r1',
                            ifu: '1234567890AB',
                            identification: 'X',
                            adresse: 'Y',
                            nature: 'Z',
                            date: '01/01/2025',
                            montant: 100_000,
                            taux: 0.12345,
                            retenue: 0,
                        },
                    ],
                },
            },
        }));

        useContribuableStore.getState().setPeriod({ year: 2026 });
        const row = useContribuableStore.getState().annexes.rslib.rows[0];
        expect(row.taux).toBe(0.02);
        expect(row.retenue).toBe(2_000);
    });

    it('recalculates RSFON retenue from yearly IRF rules', () => {
        useContribuableStore.setState((s) => ({
            ...s,
            annexes: {
                ...s.annexes,
                rsfon: {
                    rows: [
                        {
                            id: 'f1',
                            identite: 'Bailleur',
                            ifu: '1234567890AB',
                            localite: '',
                            secteur: '',
                            section: '',
                            lot: '',
                            parcelle: '',
                            loyer: 400_000,
                            retenue: 0,
                        },
                    ],
                },
            },
        }));

        useContribuableStore.getState().setPeriod({ year: 2026 });
        const row = useContribuableStore.getState().annexes.rsfon.rows[0];
        expect(row.retenue).toBe(calcIRF(400_000, 2026).retenue);
    });
});

