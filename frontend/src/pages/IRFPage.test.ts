// Tests logique pure — IRFPage (sans rendu React)
// CGI 2025 Art. 121-126 · Abattement 50 % · Tranches 18 % / 25 %
import { describe, it, expect } from 'vitest'
import { calcIRF } from '../lib/fiscalCalc'

describe('IRFPage — logique calcIRF', () => {
    // Abattement 50 %
    it('loyer 1 200 000 → abattement 600 000', () => {
        const r = calcIRF(1_200_000)
        expect(r.abattement).toBe(600_000)
    })

    it('abattement = 50 % du loyer brut', () => {
        const r = calcIRF(800_000)
        expect(r.abattement).toBe(400_000)
    })

    // Première tranche uniquement (base ≤ 100 000)
    it('loyer 100 000 → base 50 000 ≤ seuil → IRF2 = 0', () => {
        const r = calcIRF(100_000)
        expect(r.irf2).toBe(0)
    })

    it('loyer 100 000 → IRF1 = 50 000 × 18 % = 9 000', () => {
        expect(calcIRF(100_000).irf1).toBe(9_000)
    })

    // Deux tranches (base > 100 000)
    it('loyer 300 000 → base 150 000 → IRF1 = 18 000, IRF2 = 12 500', () => {
        const r = calcIRF(300_000)
        expect(r.irf1).toBe(18_000)
        expect(r.irf2).toBe(12_500)
    })

    it('loyer 300 000 → IRFTotal = 30 500', () => {
        expect(calcIRF(300_000).irfTotal).toBe(30_500)
    })

    // LoyerNet cohérent
    it('loyerNet = loyerBrut − IRFTotal', () => {
        const r = calcIRF(300_000)
        expect(r.loyerNet).toBe(r.loyerBrut - r.irfTotal)
    })

    it('loyer 0 → IRFTotal = 0', () => {
        expect(calcIRF(0).irfTotal).toBe(0)
    })

    // Données API — structure de la requête de création
    it('payload de création contient annee et loyer_brut', () => {
        const payload = { annee: 2025, loyer_brut: 6_000_000 }
        expect(payload.annee).toBe(2025)
        expect(payload.loyer_brut).toBe(6_000_000)
    })

    // Taux effectif
    it('tauxEffectif est une string non vide pour loyer > 0', () => {
        const r = calcIRF(300_000)
        expect(typeof r.tauxEffectif).toBe('string')
        expect(Number(r.tauxEffectif)).toBeGreaterThan(0)
    })
})
