import { describe, expect, it } from 'vitest';
import {
    calcCNSS,
    calcCNSSPatronale,
    calcHTVA,
    calcIRF,
    calcSalarie,
    calcTPA,
    calcTVA18,
} from './contribuableCalc';
import { getFiscalRules } from './fiscalRules';

describe('fiscalRules versioning', () => {
    it('returns explicit rules for known year', () => {
        const rules2025 = getFiscalRules(2025);
        const rules2026 = getFiscalRules(2026);
        expect(rules2025.year).toBe(2025);
        expect(rules2026.year).toBe(2026);
    });

    it('falls back to latest known year <= requested', () => {
        const rules = getFiscalRules(2099);
        expect(rules.year).toBe(2026);
    });

    it('falls back to first known year for very old date', () => {
        const rules = getFiscalRules(1990);
        expect(rules.year).toBe(2025);
    });
});

describe('contribuableCalc with year', () => {
    it('keeps deterministic salary calculation for 2025 baseline', () => {
        const r = calcSalarie(200_000, 'NON_CADRE', 2, 2025);
        expect(r.cnss).toBe(11_000);
        expect(r.baseImp).toBe(141_750);
        expect(r.iutsDu).toBe(15_185);
    });

    it('cnss uses configured plafond and rate', () => {
        expect(calcCNSS(700_000, 2025)).toBe(33_000);
        expect(calcCNSS(700_000, 2026)).toBe(33_000);
    });

    it('cnss patronale uses configured branch rates', () => {
        expect(calcCNSSPatronale(100_000, 2025)).toBe(16_100);
        expect(calcCNSSPatronale(700_000, 2025)).toBe(96_600);
    });

    it('cnss patronale supports CARFO branch rate', () => {
        expect(calcCNSSPatronale(100_000, 2025, 'CARFO')).toBe(7_000);
    });

    it('tpa and tva remain aligned to yearly rules', () => {
        expect(calcTPA(100_000, 2025)).toBe(3_000);
        expect(calcTVA18(100_000, 2025)).toBe(18_000);
        expect(calcHTVA(118_000, 2025)).toBe(100_000);
    });

    it('irf calculation is stable for configured year', () => {
        const r = calcIRF(400_000, 2025);
        expect(r.base).toBe(200_000);
        expect(r.retenue).toBe(43_000);
    });
});

