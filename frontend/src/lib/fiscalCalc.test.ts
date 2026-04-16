// ─── Tests unitaires fiscalCalc.ts — CGI 2025 ─────────────────
// Miroir exact des tests Go (iuts_test.go / cgi2025_test.go)

import { describe, it, expect } from 'vitest'
import {
    calcIUTS,
    calcEmploye,
    calcTVA,
    calcIRF,
    calcIRCM,
    calcRAS,
    calcCME,
} from './fiscalCalc'

// ─── calcIUTS ─────────────────────────────────────────────────

describe('calcIUTS — barème CGI 2025 (9 tranches)', () => {
    it('base 0 → IUTS = 0', () => {
        expect(calcIUTS(0)).toBe(0)
    })

    it('base négative → IUTS = 0', () => {
        expect(calcIUTS(-5_000)).toBe(0)
    })

    it('base 30 000 (exonéré) → 0', () => {
        expect(calcIUTS(30_000)).toBe(0)
    })

    it('base 50 000 → 2 400 (12% sur 20 000)', () => {
        expect(calcIUTS(50_000)).toBe(2_400)
    })

    it('base 80 000 → 6 600', () => {
        // 2 400 + 30k × 14% = 2400 + 4200 = 6600
        expect(calcIUTS(80_000)).toBe(6_600)
    })

    it('base 120 000 → 13 000', () => {
        // 6600 + 40k × 16% = 6600 + 6400 = 13 000
        expect(calcIUTS(120_000)).toBe(13_000)
    })

    it('base 170 000 → 22 000', () => {
        // 13 000 + 50k × 18% = 13 000 + 9 000 = 22 000
        expect(calcIUTS(170_000)).toBe(22_000)
    })

    it('base 250 000 → 38 000', () => {
        // 22 000 + 80k × 20% = 22 000 + 16 000 = 38 000
        expect(calcIUTS(250_000)).toBe(38_000)
    })

    it('base 400 000 → 74 000', () => {
        // 38 000 + 150k × 24% = 38 000 + 36 000 = 74 000
        expect(calcIUTS(400_000)).toBe(74_000)
    })

    it('base 600 000 → 130 000', () => {
        // 74 000 + 200k × 28% = 74 000 + 56 000 = 130 000
        expect(calcIUTS(600_000)).toBe(130_000)
    })

    it('base 700 000 → 160 000 (tranche 30 %)', () => {
        // 130 000 + 100k × 30% = 130 000 + 30 000 = 160 000
        expect(calcIUTS(700_000)).toBe(160_000)
    })

    it('barème croissant : IUTS(500k) > IUTS(300k)', () => {
        expect(calcIUTS(500_000)).toBeGreaterThan(calcIUTS(300_000))
    })
})

// ─── calcEmploye ──────────────────────────────────────────────

describe('calcEmploye — bulletin salarial', () => {
    it('salaire de base 95 000 + ancienneté 4 750 + logement 20 000 + transport 15 000', () => {
        const res = calcEmploye({
            salaire_base: 95_000, anciennete: 4_750, heures_sup: 0,
            logement: 20_000, transport: 15_000, fonction: 0,
            charges: 0, categorie: 'Non-cadre', cotisation: 'CNSS',
        })
        expect(res.remBrute).toBe(134_750)
        expect(res.cotSoc).toBeGreaterThan(0)
        expect(res.iutsNet).toBeGreaterThanOrEqual(0)
        expect(res.netAPayer).toBeLessThan(res.remBrute)
    })

    it('CARFO → cotSoc = brute × 6 % (plafonné à 600k)', () => {
        const res = calcEmploye({
            salaire_base: 200_000, anciennete: 10_000, heures_sup: 0,
            logement: 0, transport: 0, fonction: 0,
            charges: 0, categorie: 'Non-cadre', cotisation: 'CARFO',
        })
        const expected = Math.round(Math.min(210_000, 600_000) * 0.06)
        expect(res.cotSoc).toBe(expected)
    })

    it('CNSS → cotSoc = brute × 5.5 %', () => {
        const res = calcEmploye({
            salaire_base: 150_000, anciennete: 0, heures_sup: 0,
            logement: 0, transport: 0, fonction: 0,
            charges: 0, categorie: 'Non-cadre', cotisation: 'CNSS',
        })
        const expected = Math.round(150_000 * 0.055)
        expect(res.cotSoc).toBe(expected)
    })

    it('abattement familial plafonné à 40 % de IUTSBrut', () => {
        const res = calcEmploye({
            salaire_base: 150_000, anciennete: 0, heures_sup: 0,
            logement: 0, transport: 0, fonction: 0,
            charges: 4, categorie: 'Non-cadre', cotisation: 'CNSS',
        })
        const abatt = res.iutsBrut - res.iutsNet
        expect(abatt).toBeLessThanOrEqual(res.iutsBrut * 0.40 + 0.01)
    })

    it('salaire net toujours positif', () => {
        const cases = [
            { salaire_base: 0, anciennete: 0, heures_sup: 0, logement: 0, transport: 0, fonction: 0, charges: 0, categorie: 'Non-cadre' as const, cotisation: 'CNSS' as const },
            { salaire_base: 30_000, anciennete: 0, heures_sup: 0, logement: 0, transport: 0, fonction: 0, charges: 0, categorie: 'Non-cadre' as const, cotisation: 'CNSS' as const },
            { salaire_base: 1_000_000, anciennete: 0, heures_sup: 0, logement: 0, transport: 0, fonction: 0, charges: 4, categorie: 'Cadre' as const, cotisation: 'CARFO' as const },
        ]
        for (const e of cases) {
            const res = calcEmploye(e)
            expect(res.netAPayer).toBeGreaterThanOrEqual(0)
            expect(res.iutsNet).toBeGreaterThanOrEqual(0)
        }
    })

    it('cadre → abattement forfaitaire 20 % vs non-cadre 25 %', () => {
        const base = { salaire_base: 300_000, anciennete: 0, heures_sup: 0, logement: 0, transport: 0, fonction: 0, charges: 0, cotisation: 'CNSS' as const }
        const resCadre = calcEmploye({ ...base, categorie: 'Cadre' })
        const resNonCadre = calcEmploye({ ...base, categorie: 'Non-cadre' })
        // Non-cadre a abattement plus grand → base imposable plus petite → moins d'IUTS
        expect(resNonCadre.iutsBrut).toBeLessThanOrEqual(resCadre.iutsBrut)
    })

    it('plafond CNSS 600 000 respecté', () => {
        const res = calcEmploye({
            salaire_base: 900_000, anciennete: 0, heures_sup: 0,
            logement: 0, transport: 0, fonction: 0,
            charges: 0, categorie: 'Cadre', cotisation: 'CNSS',
        })
        const maxCot = Math.round(600_000 * 0.055)
        expect(res.cotSoc).toBe(maxCot)
    })

    it('exonérations accessoires : logement ≤ 75k, transport ≤ 30k, fonction ≤ 50k', () => {
        const res = calcEmploye({
            salaire_base: 200_000, anciennete: 0, heures_sup: 0,
            logement: 200_000, transport: 200_000, fonction: 200_000,
            charges: 0, categorie: 'Non-cadre', cotisation: 'CNSS',
        })
        expect(res.exoLog).toBe(75_000)
        expect(res.exoTrans).toBe(30_000)
        expect(res.exoFonct).toBe(50_000)
    })
})

// ─── calcTVA ─────────────────────────────────────────────────

describe('calcTVA — CGI 2025 Art. 317', () => {
    it('taux standard 18 % sur 1 000 000 → TVA 180 000, TTC 1 180 000', () => {
        const res = calcTVA(1_000_000, 0.18)
        expect(res.tva).toBe(180_000)
        expect(res.ttc).toBe(1_180_000)
        expect(res.ht).toBe(1_000_000)
    })

    it('taux hôtellerie 10 % sur 500 000 → TVA 50 000', () => {
        const res = calcTVA(500_000, 0.10)
        expect(res.tva).toBe(50_000)
    })

    it('montant 0 → TVA 0 et TTC 0', () => {
        const res = calcTVA(0)
        expect(res.tva).toBe(0)
        expect(res.ttc).toBe(0)
    })

    it('taux par défaut = 18 %', () => {
        const res = calcTVA(100_000)
        expect(res.tva).toBe(18_000)
    })

    it('HT + TVA = TTC toujours', () => {
        const res = calcTVA(1_234_567, 0.18)
        expect(res.ht + res.tva).toBe(res.ttc)
    })
})

// ─── calcIRF ─────────────────────────────────────────────────

describe('calcIRF — Impôt sur les Revenus Fonciers', () => {
    it('loyer 400 000 → abattement 200 000, base 200 000, IRF 43 000', () => {
        const res = calcIRF(400_000)
        expect(res.abattement).toBe(200_000)
        expect(res.baseNette).toBe(200_000)
        expect(res.irfTotal).toBe(43_000)
    })

    it('loyer 100 000 → IRF1 9 000, IRF2 0', () => {
        const res = calcIRF(100_000)
        expect(res.irf1).toBe(9_000)
        expect(res.irf2).toBe(0)
    })

    it('loyer 0 → IRF 0', () => {
        const res = calcIRF(0)
        expect(res.irfTotal).toBe(0)
    })

    it('taux effectif croît avec le loyer', () => {
        const r1 = calcIRF(200_000)
        const r2 = calcIRF(1_000_000)
        expect(parseFloat(r2.tauxEffectif as string)).toBeGreaterThan(parseFloat(r1.tauxEffectif as string))
    })

    it('loyer net = loyer brut - IRF', () => {
        const res = calcIRF(500_000)
        expect(res.loyerNet).toBe(res.loyerBrut - res.irfTotal)
    })
})

// ─── calcIRCM ────────────────────────────────────────────────

describe('calcIRCM — Revenus de Capitaux Mobiliers', () => {
    it('CREANCES 1 000 000 → IRCM 250 000 (25 %)', () => {
        const res = calcIRCM(1_000_000, 'CREANCES')
        expect(res.taux).toBe(0.25)
        expect(res.ircm).toBe(250_000)
    })

    it('OBLIGATIONS 2 000 000 → IRCM 120 000 (6 %)', () => {
        const res = calcIRCM(2_000_000, 'OBLIGATIONS')
        expect(res.taux).toBe(0.06)
        expect(res.ircm).toBe(120_000)
    })

    it('DIVIDENDES 2 000 000 → IRCM 250 000 (12.5 %)', () => {
        const res = calcIRCM(2_000_000, 'DIVIDENDES')
        expect(res.taux).toBe(0.125)
        expect(res.ircm).toBe(250_000)
    })

    it('type inconnu → fallback CREANCES (25 %)', () => {
        const res = calcIRCM(1_000_000, 'INCONNU')
        expect(res.taux).toBe(0.25)
    })

    it('Brut - IRCM = Net pour tous types', () => {
        for (const t of ['CREANCES', 'OBLIGATIONS', 'DIVIDENDES']) {
            const res = calcIRCM(500_000, t)
            expect(Math.abs(res.brut - res.ircm - res.net)).toBeLessThan(1)
        }
    })
})

// ─── calcRAS ─────────────────────────────────────────────────

describe('calcRAS — Retenue à la source', () => {
    it('RESIDENT_IFU 1 000 000 → 5 %, RAS 50 000', () => {
        const res = calcRAS(1_000_000, 'RESIDENT_IFU')
        expect(res.taux).toBe(0.05)
        expect(res.ras).toBe(50_000)
        expect(res.net).toBe(950_000)
    })

    it('NON_RESIDENT 2 000 000 → 20 %, RAS 400 000', () => {
        const res = calcRAS(2_000_000, 'NON_RESIDENT')
        expect(res.taux).toBe(0.20)
        expect(res.ras).toBe(400_000)
    })

    it('RESIDENT_IFU < 50 000 → exonéré', () => {
        const res = calcRAS(40_000, 'RESIDENT_IFU')
        expect(res.exonere).toBe(true)
        expect(res.ras).toBe(0)
    })

    it('NON_RESIDENT < 50 000 → pas exonéré', () => {
        const res = calcRAS(10_000, 'NON_RESIDENT')
        expect(res.exonere).toBe(false)
    })

    it('type inconnu → fallback 5 %', () => {
        const res = calcRAS(1_000_000, 'UNKNOWN_TYPE')
        expect(res.taux).toBe(0.05)
    })
})

// ─── calcCME ─────────────────────────────────────────────────

describe('calcCME — Contribution Micro-Entreprises', () => {
    it('Zone A CA 1 000 000 → Classe 8, CME 10 000', () => {
        const res = calcCME(1_000_000, 'A', false)
        expect(res.classe).toBe(8)
        expect(res.cme).toBe(10_000)
    })

    it('Zone A CA > 13 000 000 → Classe 1, CME 200 000', () => {
        const res = calcCME(15_000_000, 'A', false)
        expect(res.classe).toBe(1)
        expect(res.cme).toBe(200_000)
    })

    it('Zone D CA 1 000 000 → CME 2 000', () => {
        const res = calcCME(1_000_000, 'D', false)
        expect(res.cme).toBe(2_000)
    })

    it('CGA → réduction 25 %', () => {
        const resSans = calcCME(5_000_000, 'A', false)
        const resAvec = calcCME(5_000_000, 'A', true)
        expect(resAvec.cmeNet).toBe(Math.round(resSans.cme * 0.75))
    })

    it('zone inconnue → fallback Zone A', () => {
        const res = calcCME(1_000_000, 'Z', false)
        const resA = calcCME(1_000_000, 'A', false)
        expect(res.cme).toBe(resA.cme)
    })
})
