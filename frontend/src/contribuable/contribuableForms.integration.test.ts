import { beforeEach, describe, expect, it } from 'vitest';
import { calcTVA18 } from './contribuableCalc';
import { useContribuableStore } from './contribuableStore';
import {
    invalidIutsRows,
    invalidPrelRows,
    invalidRasRows,
    invalidRsfonRows,
    invalidTvaAvRows,
    invalidTvaDedRows,
    iutsFieldErrors,
    prelFieldErrors,
    rasFieldErrors,
    rsfonFieldErrors,
    tvaAvFieldErrors,
    tvaDedFieldErrors,
} from './contribuableValidation';
import type { ContribuableState } from './contribuableStore';

const memoryStorage = (() => {
    const map = new Map<string, string>();
    return {
        getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
        setItem: (k: string, v: string) => map.set(k, String(v)),
        removeItem: (k: string) => map.delete(k),
        clear: () => map.clear(),
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

function localInvalidTotal(annexes: ContribuableState['annexes']) {
    return (
        invalidIutsRows(annexes.iuts.rows) +
        invalidRsfonRows(annexes.rsfon.rows) +
        invalidRasRows(annexes.rslib.rows, 'rslib') +
        invalidRasRows(annexes.rsetr.rows, 'rsetr') +
        invalidRasRows(annexes.rspre.rows, 'rspre') +
        invalidRasRows(annexes.rstva.rows, 'rstva') +
        invalidTvaDedRows(annexes.tva.deductible) +
        invalidTvaAvRows(annexes.tva.avances) +
        invalidPrelRows(annexes.prel.rows)
    );
}

describe('contribuable forms integration (store + validation)', () => {
    beforeEach(() => {
        memoryStorage.clear();
        resetStore();
    });

    it('IUTS keeps free-text names with spaces and clears errors once complete', () => {
        const st = useContribuableStore.getState();
        st.addIutsRow();
        const rowId = useContribuableStore.getState().annexes.iuts.rows[0].id;

        // Free text with spaces should be accepted as entered.
        useContribuableStore.getState().updateIutsRow(rowId, { nom: 'Nom  Prenom Test' });
        let row = useContribuableStore.getState().annexes.iuts.rows[0];
        expect(row.nom).toBe('Nom  Prenom Test');

        // Incomplete row still invalid because salary is missing.
        expect(iutsFieldErrors(row).salaireB).toBe('Doit être > 0');
        expect(invalidIutsRows(useContribuableStore.getState().annexes.iuts.rows)).toBe(1);

        // Completing required fiscal fields removes inline errors.
        useContribuableStore.getState().updateIutsRow(rowId, { salaireB: 125000, charges: 2 });
        row = useContribuableStore.getState().annexes.iuts.rows[0];
        expect(iutsFieldErrors(row)).toEqual({});
        expect(invalidIutsRows(useContribuableStore.getState().annexes.iuts.rows)).toBe(0);
    });

    it('PREL enforces base/prelevement coherences and mirrors inline errors', () => {
        const st = useContribuableStore.getState();
        st.addPrelRow();
        const rowId = useContribuableStore.getState().annexes.prel.rows[0].id;

        useContribuableStore.getState().updatePrelRow(rowId, {
            nom: 'Client X',
            ifu: '1234567890ab',
            date: '01/01/2025',
            montantHT: 10_000,
            base: 20_000,
            prelevement: 9_000,
        });
        const row = useContribuableStore.getState().annexes.prel.rows[0];

        // Store enforces domain constraints: base <= montantHT, prelevement <= base.
        expect(row.base).toBe(10_000);
        expect(row.prelevement).toBe(9_000);
        expect(row.ifu).toBe('1234567890AB');
        expect(prelFieldErrors(row)).toEqual({});
        expect(invalidPrelRows(useContribuableStore.getState().annexes.prel.rows)).toBe(0);
    });

    it('TVA deductible auto-calculates tvaFacturee and caps tvaDed', () => {
        const st = useContribuableStore.getState();
        st.addTvaDeductible();
        const rowId = useContribuableStore.getState().annexes.tva.deductible[0].id;

        useContribuableStore.getState().updateTvaDeductible(rowId, {
            ifu: '1234567890ab',
            nom: 'Fournisseur A',
            date: '15/01/2025',
            ht: 100_000,
        });

        // Attempt to exceed TVA facturee.
        useContribuableStore.getState().updateTvaDeductible(rowId, { tvaDed: 999_999 });
        const row = useContribuableStore.getState().annexes.tva.deductible[0];

        expect(row.tvaFacturee).toBe(calcTVA18(100_000, 2025));
        expect(row.tvaDed).toBe(row.tvaFacturee);
        expect(tvaDedFieldErrors(row)).toEqual({});
        expect(invalidTvaDedRows(useContribuableStore.getState().annexes.tva.deductible)).toBe(0);
    });

    it('TVA avances compute HTVA and enforce cumul >= HTVA', () => {
        const st = useContribuableStore.getState();
        st.addTvaAvance();
        const rowId = useContribuableStore.getState().annexes.tva.avances[0].id;

        useContribuableStore.getState().updateTvaAvance(rowId, {
            ifu: '1234567890ab',
            nom: 'Commanditaire',
            ttc: 118_000,
            cumulHTVA: 1,
        });
        const row = useContribuableStore.getState().annexes.tva.avances[0];

        expect(row.ifu).toBe('1234567890AB');
        expect(row.htva).toBe(100_000);
        expect(row.cumulHTVA).toBe(100_000);
        expect(tvaAvFieldErrors(row)).toEqual({});
        expect(invalidTvaAvRows(useContribuableStore.getState().annexes.tva.avances)).toBe(0);
    });

    it('RSFON keeps free identity text and computes retenue automatically', () => {
        const st = useContribuableStore.getState();
        st.addRsfonRow();
        const rowId = useContribuableStore.getState().annexes.rsfon.rows[0].id;

        useContribuableStore.getState().updateRsfonRow(rowId, {
            identite: 'Nom Prenom Bailleur',
            ifu: '1234567890ab',
            loyer: 400_000,
        });
        const row = useContribuableStore.getState().annexes.rsfon.rows[0];

        expect(row.identite).toBe('Nom Prenom Bailleur');
        expect(row.ifu).toBe('1234567890AB');
        expect(row.retenue).toBeGreaterThan(0);
        expect(rsfonFieldErrors(row)).toEqual({});
        expect(invalidRsfonRows(useContribuableStore.getState().annexes.rsfon.rows)).toBe(0);
    });

    it('RSLIB normalizes IFU and rate, then clears validation errors', () => {
        const st = useContribuableStore.getState();
        st.addRSLibRow();
        const rowId = useContribuableStore.getState().annexes.rslib.rows[0].id;

        useContribuableStore.getState().updateRSLibRow(rowId, {
            ifu: '1234567890ab',
            identification: 'Prestataire Test',
            adresse: 'Ouaga',
            nature: 'Service',
            date: '15/01/2025',
            montant: 100_000,
            taux: 0.12345,
        });
        const row = useContribuableStore.getState().annexes.rslib.rows[0];

        expect(row.ifu).toBe('1234567890AB');
        expect(row.taux).toBe(0.02);
        expect(row.retenue).toBe(2_000);
        expect(rasFieldErrors(row, 'rslib')).toEqual({});
        expect(invalidRasRows(useContribuableStore.getState().annexes.rslib.rows, 'rslib')).toBe(0);
    });

    it('rowCount mirrors declarations navigation badges', () => {
        const st = useContribuableStore.getState();
        st.addIutsRow();
        st.addIutsRow();
        st.addRsfonRow();
        st.addRSLibRow();
        st.addTvaDeductible();
        st.addTvaAvance();
        st.addPrelRow();

        const state = useContribuableStore.getState();
        expect(state.rowCount('iuts')).toBe(2);
        expect(state.rowCount('ros')).toBe(2);
        expect(state.rowCount('tpa')).toBe(2);
        expect(state.rowCount('rsfon')).toBe(1);
        expect(state.rowCount('rslib')).toBe(1);
        expect(state.rowCount('tva')).toBe(2);
        expect(state.rowCount('prel')).toBe(1);
        expect(state.rowCount('generer')).toBe(0);
    });

    it('generation gate stays blocked if local or server errors exist', () => {
        const st = useContribuableStore.getState();
        st.addIutsRow();
        const iutsId = useContribuableStore.getState().annexes.iuts.rows[0].id;
        // Keep salary empty => 1 local anomaly.
        useContribuableStore.getState().updateIutsRow(iutsId, { nom: 'Agent Test', salaireB: 0 });

        const localInvalid = localInvalidTotal(useContribuableStore.getState().annexes);
        const serverErrorCount = 0;
        const loading = false;
        const canGenerate = localInvalid + serverErrorCount === 0 && !loading;
        expect(localInvalid).toBeGreaterThan(0);
        expect(canGenerate).toBe(false);

        // Local data corrected, but server still returns an error => still blocked.
        useContribuableStore.getState().updateIutsRow(iutsId, { salaireB: 120_000, charges: 1 });
        const localAfterFix = localInvalidTotal(useContribuableStore.getState().annexes);
        const serverErrorsAfterFix = 1;
        const canGenerateWithServerError = localAfterFix + serverErrorsAfterFix === 0 && !loading;
        expect(localAfterFix).toBe(0);
        expect(canGenerateWithServerError).toBe(false);

        // Unblocked only when local + server errors are both zero.
        const canGenerateFinal = localAfterFix + 0 === 0 && !loading;
        expect(canGenerateFinal).toBe(true);
    });
});

