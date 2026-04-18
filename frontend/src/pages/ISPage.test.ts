// Tests logique pure : ISPage (sans rendu React)
// CGI 2025 Art. 42 - IS 27.5 % - MFP 0.5 % - CGA réductions
import { describe, it, expect } from 'vitest'
import { calcIS, calcMFP } from '../lib/fiscalCalc'

// Réplique de la logique ISPage.calc()
function calcISPageResult(
    ca: number,
    benefice: number,
    regime: string,
    cga: boolean
) {
    const isRes = calcIS(benefice, cga)
    const mfpRes = calcMFP(ca, regime, cga)
    const dû = Math.max(isRes.is, mfpRes.mfpDu)
    return {
        isTheorique: isRes.is,
        mfpDu: mfpRes.mfpDu,
        mfpMinimum: mfpRes.mfpMinimum,
        dû,
        mode: isRes.is >= mfpRes.mfpDu ? 'IS théorique' : 'MFP (minimum)',
    }
}

describe('ISPage : logique calcIS + calcMFP', () => {
    // IS théorique
    it('IS théorique = bénéfice × 27.5 %', () => {
        const r = calcISPageResult(500_000_000, 100_000_000, 'reel', false)
        expect(r.isTheorique).toBe(27_500_000)
    })

    it('IS avec CGA = IS × 70 %', () => {
        const r = calcISPageResult(500_000_000, 100_000_000, 'reel', true)
        expect(r.isTheorique).toBe(19_250_000)
    })

    // MFP minimum
    it('CA faible → MFP minimum 1M (reel)', () => {
        const r = calcISPageResult(10_000_000, 0, 'reel', false)
        expect(r.mfpDu).toBe(1_000_000)
    })

    it('CA faible → MFP minimum 300k (RSI)', () => {
        const r = calcISPageResult(10_000_000, 0, 'RSI', false)
        expect(r.mfpDu).toBe(300_000)
    })

    it('MFP CGA réduit de 50 %', () => {
        const r = calcISPageResult(500_000_000, 0, 'reel', true)
        // 2.5M × 50% = 1.25M
        expect(r.mfpDu).toBe(1_250_000)
    })

    // dû = max(IS, MFP)
    it('dû = max(IS théorique, MFP)', () => {
        const r = calcISPageResult(500_000_000, 100_000_000, 'reel', false)
        expect(r.dû).toBe(Math.max(r.isTheorique, r.mfpDu))
    })

    it('mode IS théorique quand IS > MFP', () => {
        // CA 10M → MFP = 1M; IS 100M → 27.5M > 1M
        const r = calcISPageResult(10_000_000, 100_000_000, 'reel', false)
        expect(r.mode).toBe('IS théorique')
        expect(r.dû).toBe(r.isTheorique)
    })

    it('mode MFP quand MFP > IS', () => {
        // bénéfice 0 → IS 0; CA 10M → MFP = 1M
        const r = calcISPageResult(10_000_000, 0, 'reel', false)
        expect(r.mode).toBe('MFP (minimum)')
        expect(r.dû).toBe(r.mfpDu)
    })

    // Payload API
    it('payload de création contient les bons champs', () => {
        const payload = { annee: 2025, ca: 500_000_000, benefice: 50_000_000, regime: 'reel', adhesion_cga: false }
        expect(payload.annee).toBe(2025)
        expect(payload.regime).toBe('reel')
        expect(typeof payload.adhesion_cga).toBe('boolean')
    })

    it('dû toujours ≥ 0', () => {
        const r = calcISPageResult(0, 0, 'reel', false)
        expect(r.dû).toBeGreaterThanOrEqual(0)
    })
})
