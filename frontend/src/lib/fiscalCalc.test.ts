// --- Tests unitaires fiscalCalc.ts : CGI 2025 -----------------
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
    calcPenalite,
    calcIS,
    calcMFP,
    calcPatente,
    calcHeuresSup,
    CME_CA_PLAFOND,
    HEURES_MOIS_STANDARD,
} from './fiscalCalc'

// --- calcIUTS -------------------------------------------------

describe('calcIUTS : barème CGI 2025 (règles versionnées)', () => {
    it('base 0 → IUTS = 0', () => {
        expect(calcIUTS(0)).toBe(0)
    })

    it('base négative → IUTS = 0', () => {
        expect(calcIUTS(-5_000)).toBe(0)
    })

    it('base 30 000 (exonéré) → 0', () => {
        expect(calcIUTS(30_000)).toBe(0)
    })

    it('base 50 000 → 2 420 (12,1% sur 20 000)', () => {
        expect(calcIUTS(50_000)).toBe(2_420)
    })

    it('base 80 000 → 6 590', () => {
        // 2 420 + 30k × 13,9% = 2 420 + 4 170 = 6 590
        expect(calcIUTS(80_000)).toBe(6_590)
    })

    it('base 120 000 → 12 870', () => {
        // 6 590 + 40k × 15,7% = 6 590 + 6 280 = 12 870
        expect(calcIUTS(120_000)).toBe(12_870)
    })

    it('base 170 000 → 22 070', () => {
        // 12 870 + 50k × 18,4% = 12 870 + 9 200 = 22 070
        expect(calcIUTS(170_000)).toBe(22_070)
    })

    it('base 250 000 → 39 430', () => {
        // 22 070 + 80k × 21,7% = 22 070 + 17 360 = 39 430
        expect(calcIUTS(250_000)).toBe(39_430)
    })

    it('base 400 000 → 76 930', () => {
        // 39 430 + 150k × 25% = 39 430 + 37 500 = 76 930
        expect(calcIUTS(400_000)).toBe(76_930)
    })

    it('base 600 000 → 126 930', () => {
        // 76 930 + 200k × 25% = 76 930 + 50 000 = 126 930
        expect(calcIUTS(600_000)).toBe(126_930)
    })

    it('base 700 000 → 151 930 (tranche finale 25 %)', () => {
        // 126 930 + 100k × 25% = 151 930
        expect(calcIUTS(700_000)).toBe(151_930)
    })

    it('barème croissant : IUTS(500k) > IUTS(300k)', () => {
        expect(calcIUTS(500_000)).toBeGreaterThan(calcIUTS(300_000))
    })
})

// --- calcEmploye ----------------------------------------------

describe('calcEmploye : bulletin salarial', () => {
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

    it('netAPayer = remBrute − IUTS − CNSS − FSP (formule compl\u00e8te BF)', () => {
        // FSP = 1 % \u00d7 (brute \u2212 IUTS \u2212 CNSS), pr\u00e9lev\u00e9 sur le salaire net
        const inputs = [
            { salaire_base: 150_000, anciennete: 7_500, heures_sup: 0, logement: 30_000, transport: 15_000, fonction: 0, charges: 1, categorie: 'Non-cadre' as const, cotisation: 'CNSS' as const },
            { salaire_base: 400_000, anciennete: 0, heures_sup: 0, logement: 75_000, transport: 30_000, fonction: 50_000, charges: 3, categorie: 'Cadre' as const, cotisation: 'CARFO' as const },
        ]
        for (const e of inputs) {
            const r = calcEmploye(e)
            const netAvantFSP = r.remBrute - r.iutsNet - r.cotSoc
            const fspExpected = Math.round(netAvantFSP * 0.01)
            expect(r.fsp).toBe(fspExpected)
            expect(r.netAPayer).toBe(netAvantFSP - fspExpected)
        }
    })

    it('FSP = 1 % du net avant FSP (d\u00e9cret pr\u00e9sidentiel BF 2023)', () => {
        const r = calcEmploye({
            salaire_base: 200_000, anciennete: 0, heures_sup: 0,
            logement: 0, transport: 0, fonction: 0,
            charges: 0, categorie: 'Non-cadre', cotisation: 'CNSS',
        })
        const netAvantFSP = r.remBrute - r.iutsNet - r.cotSoc
        expect(r.fsp).toBe(Math.round(netAvantFSP * 0.01))
        // Le FSP est bien un entier FCFA
        expect(Number.isInteger(r.fsp)).toBe(true)
    })
})

// --- calcTVA -------------------------------------------------

describe('calcTVA : CGI 2025 Art. 317', () => {
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

// --- calcIRF -------------------------------------------------

describe('calcIRF : Impôt sur les Revenus Fonciers', () => {
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

// --- calcIRCM ------------------------------------------------

describe('calcIRCM : Revenus de Capitaux Mobiliers', () => {
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

// --- calcRAS -------------------------------------------------

describe('calcRAS : Retenue à la source', () => {
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

// --- calcCME -------------------------------------------------

describe('calcCME : Contribution Micro-Entreprises', () => {
    it('Zone A CA 1 000 000 → Classe 8, CME 10 000', () => {
        const res = calcCME(1_000_000, 'A', false)
        expect(res).not.toBeNull()
        expect(res!.classe).toBe(8)
        expect(res!.cme).toBe(10_000)
    })

    it('Zone A CA 15 000 000 (plafond) → Classe 1, CME 200 000', () => {
        const res = calcCME(15_000_000, 'A', false)
        expect(res).not.toBeNull()
        expect(res!.classe).toBe(1)
        expect(res!.cme).toBe(200_000)
    })

    it('CA > 15 000 000 (hors régime CME) → null', () => {
        expect(calcCME(15_000_001, 'A', false)).toBeNull()
        expect(calcCME(50_000_000, 'B', true)).toBeNull()
    })

    it('CME_CA_PLAFOND = 15 000 000', () => {
        expect(CME_CA_PLAFOND).toBe(15_000_000)
    })

    it('Zone D CA 1 000 000 → CME 2 000', () => {
        const res = calcCME(1_000_000, 'D', false)
        expect(res!.cme).toBe(2_000)
    })

    it('CGA → réduction 25 %', () => {
        const resSans = calcCME(5_000_000, 'A', false)
        const resAvec = calcCME(5_000_000, 'A', true)
        expect(resAvec!.cmeNet).toBe(Math.round(resSans!.cme * 0.75))
    })

    it('zone inconnue → fallback Zone A', () => {
        const res = calcCME(1_000_000, 'Z', false)
        const resA = calcCME(1_000_000, 'A', false)
        expect(res!.cme).toBe(resA!.cme)
    })
})

// --- calcHeuresSup : Code du Travail BF Art. 151 -------------

describe('calcHeuresSup : heures supplémentaires', () => {
    // salaire_base 200 000 FCFA → tauxHoraire brut = 200000/173.33 = 1153.868...
    // Math.round → 1154 FCFA/h retourné, mais calculs internes sur le flottant brut.
    const salaire = 200_000

    it('heures normales (+25 %) - taux horaire retourné = 1 154 FCFA/h', () => {
        const r = calcHeuresSup(salaire, 8, 'normale')
        expect(r.tauxHoraire).toBe(1154)
        expect(r.majoration).toBe(0.25)
        // montantMaj = round(1153.868... * 8 * 0.25) = round(2307.74) = 2308
        expect(r.montantMaj).toBe(2308)
        // montantTotal = round(1153.868... * 8) + 2308 = round(9230.95) + 2308 = 9231 + 2308 = 11539
        expect(r.montantTotal).toBe(11539)
    })

    it('heures nuit/dimanche (+50 %)', () => {
        const r = calcHeuresSup(salaire, 4, 'nuit_dimanche')
        expect(r.majoration).toBe(0.50)
        // tauxHoraire brut = 1153.868..., montantMaj = round(1153.868 * 4 * 0.50) = round(2307.74) = 2308
        expect(r.montantMaj).toBe(Math.round((salaire / HEURES_MOIS_STANDARD) * 4 * 0.50))
    })

    it('jours fériés (+100 %)', () => {
        const r = calcHeuresSup(salaire, 8, 'ferie')
        expect(r.majoration).toBe(1.00)
        // montantMaj = round(1153.868... * 8 * 1.00) = round(9230.95) = 9231
        expect(r.montantMaj).toBe(9231)
    })

    it('taux horaire standard = salaire_base / 173.33', () => {
        const r = calcHeuresSup(300_000, 1, 'normale')
        expect(r.tauxHoraire).toBe(Math.round(300_000 / HEURES_MOIS_STANDARD))
    })

    it('HEURES_MOIS_STANDARD = 173.33', () => {
        expect(HEURES_MOIS_STANDARD).toBeCloseTo(173.33, 1)
    })
})

// --- calcPenalite : CGI 2025 Art. 607 -------------------------

describe('calcPenalite : pénalités de retard', () => {
    it('0 mois → 0', () => {
        expect(calcPenalite(100_000, 0)).toBe(0)
    })

    it('montant 0 → 0', () => {
        expect(calcPenalite(0, 3)).toBe(0)
    })

    it('1 mois → majoration 10 % + intérêts 1 % = 11 000 sur 100 000', () => {
        // majoration = 10 000, intérêts = 1 000, total = 11 000
        expect(calcPenalite(100_000, 1)).toBe(11_000)
    })

    it('3 mois → majoration 16 % + intérêts 3 % = 19 000 sur 100 000', () => {
        // tauxMaj = 10 % + 2×3 % = 16 %; interets = 1 %×3 = 3 %
        expect(calcPenalite(100_000, 3)).toBe(19_000)
    })

    it('plancher minimum 5 000 FCFA pour un très petit montant', () => {
        // montant 1 000, 1 mois → 11 %, total = 110 < 5 000 → plancher = 5 000
        expect(calcPenalite(1_000, 1)).toBe(5_000)
    })

    it('plafond 100 % du montant dû pour un retard très long', () => {
        // Très long retard → total calculé dépasse 100 % → plafonné au montant dû
        const montant = 1_000_000
        const penalite = calcPenalite(montant, 100)
        expect(penalite).toBeLessThanOrEqual(montant)
    })

    it('résultat toujours entier (pas de centimes en FCFA)', () => {
        expect(Number.isInteger(calcPenalite(123_456, 2))).toBe(true)
        expect(Number.isInteger(calcPenalite(77_777, 5))).toBe(true)
    })
})

// --- calcIS : IS/IBICA CGI 2025 Art. 42 ----------------------

describe('calcIS : impôt sur les sociétés', () => {
    it('taux 27.5 % sans CGA', () => {
        const r = calcIS(100_000_000, false)
        expect(r.is).toBe(27_500_000)
    })

    it('réduction CGA 30 % → 70 % de 27.5 %', () => {
        const r = calcIS(100_000_000, true)
        // 27 500 000 × 70 % = 19 250 000
        expect(r.is).toBe(19_250_000)
    })

    it('bénéfice 0 → IS 0', () => {
        expect(calcIS(0, false).is).toBe(0)
    })

    it('bénéfice 0 avec CGA → IS 0', () => {
        expect(calcIS(0, true).is).toBe(0)
    })

    it('benefice retourné inchangé', () => {
        const r = calcIS(50_000_000, false)
        expect(r.benefice).toBe(50_000_000)
    })
})

// --- calcMFP : minimum forfaitaire de perception --------------

describe('calcMFP : minimum forfaitaire de perception', () => {
    it('CA faible → minimum 1 M (régime réel)', () => {
        // CA 10M → 0.5 % = 50k < 1M → MFPDu = 1M
        const r = calcMFP(10_000_000, 'reel', false)
        expect(r.mfpDu).toBe(1_000_000)
    })

    it('CA faible → minimum 300k (régime RSI)', () => {
        const r = calcMFP(1_000_000, 'RSI', false)
        expect(r.mfpDu).toBe(300_000)
    })

    it('CA élevé → calculé dépasse le minimum', () => {
        // CA 500M → 0.5 % = 2.5M > 1M → MFPDu = 2.5M
        const r = calcMFP(500_000_000, 'reel', false)
        expect(r.mfpDu).toBe(2_500_000)
    })

    it('réduction CGA 50 %', () => {
        const r = calcMFP(500_000_000, 'reel', true)
        expect(r.mfpDu).toBe(1_250_000)
    })

    it('mfpCalcule = CA × 0.5 %', () => {
        const r = calcMFP(400_000_000, 'reel', false)
        expect(r.mfpCalcule).toBe(2_000_000)
    })

    it('mfpMinimum RSI = 300 000', () => {
        expect(calcMFP(0, 'RSI', false).mfpMinimum).toBe(300_000)
    })

    it('mfpMinimum réel = 1 000 000', () => {
        expect(calcMFP(0, 'reel', false).mfpMinimum).toBe(1_000_000)
    })
})

// --- calcPatente : contribution des patentes ------------------

describe('calcPatente : droits fixes et proportionnels', () => {
    it('CA ≤ 5M → droit fixe 10 000', () => {
        expect(calcPatente(5_000_000, 0).droitFixe).toBe(10_000)
    })

    it('CA = 200M → droit fixe 350 000', () => {
        expect(calcPatente(200_000_000, 0).droitFixe).toBe(350_000)
    })

    it('droit proportionnel = 1 % de la valeur locative', () => {
        // VL = 1 200 000 → 1 % = 12 000
        expect(calcPatente(5_000_000, 1_200_000).droitProp).toBe(12_000)
    })

    it('totalPatente = droitFixe + droitProp', () => {
        const r = calcPatente(20_000_000, 2_400_000)
        expect(r.totalPatente).toBe(r.droitFixe + r.droitProp)
    })

    it('sans valeur locative → droitProp = 0', () => {
        expect(calcPatente(5_000_000, 0).droitProp).toBe(0)
    })

    it('droit fixe croît avec le CA', () => {
        const r1 = calcPatente(5_000_000, 0)
        const r2 = calcPatente(100_000_000, 0)
        expect(r2.droitFixe).toBeGreaterThan(r1.droitFixe)
    })
})

