package calc_test

import (
	"math"
	"testing"

	"github.com/fisca-app/backend/internal/calc"
)

// --- TVA -------------------------------------------------------

func TestCalcTVA_Taux18(t *testing.T) {
	res := calc.CalcTVA(1_000_000, calc.TVATauxStandard)
	if res.TVA != 180_000 {
		t.Errorf("TVA = %v, want 180000", res.TVA)
	}
	if res.TTC != 1_180_000 {
		t.Errorf("TTC = %v, want 1180000", res.TTC)
	}
	if res.HT != 1_000_000 {
		t.Errorf("HT = %v, want 1000000", res.HT)
	}
}

func TestCalcTVA_TauxHotellerie(t *testing.T) {
	res := calc.CalcTVA(500_000, calc.TVATauxHotellerie)
	if res.TVA != 50_000 {
		t.Errorf("TVA hôtellerie = %v, want 50000", res.TVA)
	}
}

func TestCalcTVAFromTTC_Coherent(t *testing.T) {
	ttc := 1_180_000.0
	res := calc.CalcTVAFromTTC(ttc, calc.TVATauxStandard)
	// HT + TVA doit redonner le TTC
	if math.Abs(res.HT+res.TVA-ttc) > 1 {
		t.Errorf("HT+TVA = %v, want %v", res.HT+res.TVA, ttc)
	}
}

func TestCalcTVA_Zero(t *testing.T) {
	res := calc.CalcTVA(0, calc.TVATauxStandard)
	if res.TVA != 0 || res.TTC != 0 {
		t.Errorf("CalcTVA(0) = %+v, want zeros", res)
	}
}

func TestCalcSoldeTVA(t *testing.T) {
	lignes := []calc.TVALigneInput{
		{TypeOp: "collecte", MontantHT: 1_000_000, Taux: 0.18},
		{TypeOp: "deductible", MontantHT: 400_000, Taux: 0.18},
	}
	res := calc.CalcSoldeTVA(lignes)
	// TVA collectée : 180 000, déductible : 72 000, solde : 108 000
	if res.Collectee != 180_000 {
		t.Errorf("TVA collectée = %v, want 180000", res.Collectee)
	}
	if res.Deductible != 72_000 {
		t.Errorf("TVA déductible = %v, want 72000", res.Deductible)
	}
	if res.Solde != 108_000 {
		t.Errorf("Solde TVA = %v, want 108000", res.Solde)
	}
	if res.AVerser != 108_000 {
		t.Errorf("À verser = %v, want 108000", res.AVerser)
	}
	if res.ARembourser != 0 {
		t.Errorf("À rembourser = %v, want 0", res.ARembourser)
	}
}

func TestCalcSoldeTVA_Credit(t *testing.T) {
	// Plus de déductible que de collectée → crédit TVA
	lignes := []calc.TVALigneInput{
		{TypeOp: "collecte", MontantHT: 100_000, Taux: 0.18},
		{TypeOp: "deductible", MontantHT: 300_000, Taux: 0.18},
	}
	res := calc.CalcSoldeTVA(lignes)
	if res.AVerser != 0 {
		t.Errorf("AVerser doit être 0 en cas de crédit, got %v", res.AVerser)
	}
	if res.ARembourser <= 0 {
		t.Errorf("ARembourser doit être > 0 en cas de crédit, got %v", res.ARembourser)
	}
}

// --- RAS -------------------------------------------------------

func TestCalcRAS_ResidentIFU(t *testing.T) {
	res := calc.CalcRAS(1_000_000, "RESIDENT_IFU")
	if res.Taux != 0.05 {
		t.Errorf("Taux RAS RESIDENT_IFU = %v, want 0.05", res.Taux)
	}
	if res.RAS != 50_000 {
		t.Errorf("RAS = %v, want 50000", res.RAS)
	}
	if res.Net != 950_000 {
		t.Errorf("Net = %v, want 950000", res.Net)
	}
}

func TestCalcRAS_NonResident(t *testing.T) {
	res := calc.CalcRAS(2_000_000, "NON_RESIDENT")
	if res.Taux != 0.20 {
		t.Errorf("Taux NON_RESIDENT = %v, want 0.20", res.Taux)
	}
	if res.RAS != 400_000 {
		t.Errorf("RAS NON_RESIDENT = %v, want 400000", res.RAS)
	}
}

func TestCalcRAS_SeuilExoneration(t *testing.T) {
	// Montant < 50 000 FCFA → exonéré pour RESIDENT_IFU
	res := calc.CalcRAS(40_000, "RESIDENT_IFU")
	if !res.Exonere {
		t.Errorf("Devrait être exonéré (< seuil 50 000 FCFA)")
	}
	if res.RAS != 0 {
		t.Errorf("RAS exonéré doit être 0, got %v", res.RAS)
	}
}

func TestCalcRAS_NonResidentSansSeuilExo(t *testing.T) {
	// NON_RESIDENT → pas de seuil d'exonération
	res := calc.CalcRAS(10_000, "NON_RESIDENT")
	if res.Exonere {
		t.Errorf("NON_RESIDENT ne doit pas être exonéré")
	}
}

func TestCalcRAS_TypeInconnu(t *testing.T) {
	// Type inconnu → fallback RESIDENT_IFU (5%)
	res := calc.CalcRAS(1_000_000, "INCONNU")
	if res.Taux != 0.05 {
		t.Errorf("Fallback taux = %v, want 0.05", res.Taux)
	}
}

// --- IRF -------------------------------------------------------

func TestCalcIRF_DeuxTranches(t *testing.T) {
	// Loyer brut 400 000 → base 200 000 → 100k×18% + 100k×25% = 18k+25k = 43k
	res := calc.CalcIRF(400_000)
	if res.Abattement != 200_000 {
		t.Errorf("Abattement IRF = %v, want 200000", res.Abattement)
	}
	if res.BaseNette != 200_000 {
		t.Errorf("BaseNette IRF = %v, want 200000", res.BaseNette)
	}
	if res.IRFTotal != 43_000 {
		t.Errorf("IRFTotal = %v, want 43000", res.IRFTotal)
	}
}

func TestCalcIRF_PremiereTranche(t *testing.T) {
	// Loyer 100 000 → base 50 000 → tranche 18% seulement
	res := calc.CalcIRF(100_000)
	if res.IRF1 != 9_000 {
		t.Errorf("IRF1 = %v, want 9000", res.IRF1)
	}
	if res.IRF2 != 0 {
		t.Errorf("IRF2 = %v, want 0", res.IRF2)
	}
}

func TestCalcIRF_Zero(t *testing.T) {
	res := calc.CalcIRF(0)
	if res.IRFTotal != 0 {
		t.Errorf("IRF(0) = %v, want 0", res.IRFTotal)
	}
	if res.TauxEffectif != 0 {
		t.Errorf("TauxEffectif(0) = %v, want 0", res.TauxEffectif)
	}
}

func TestCalcIRF_TauxEffectifCroissant(t *testing.T) {
	// Taux effectif doit croître avec le loyer
	res1 := calc.CalcIRF(200_000)
	res2 := calc.CalcIRF(1_000_000)
	if res2.TauxEffectif <= res1.TauxEffectif {
		t.Errorf("Taux effectif doit croître: %.2f%% <= %.2f%%", res2.TauxEffectif, res1.TauxEffectif)
	}
}

// --- IRCM ------------------------------------------------------

func TestCalcIRCM_Creances(t *testing.T) {
	res := calc.CalcIRCM(1_000_000, "CREANCES")
	if res.Taux != 0.25 {
		t.Errorf("Taux CREANCES = %v, want 0.25", res.Taux)
	}
	if res.IRCM != 250_000 {
		t.Errorf("IRCM CREANCES = %v, want 250000", res.IRCM)
	}
}

func TestCalcIRCM_Obligations(t *testing.T) {
	res := calc.CalcIRCM(2_000_000, "OBLIGATIONS")
	if res.Taux != 0.06 {
		t.Errorf("Taux OBLIGATIONS = %v, want 0.06", res.Taux)
	}
	if res.IRCM != 120_000 {
		t.Errorf("IRCM OBLIGATIONS = %v, want 120000", res.IRCM)
	}
}

func TestCalcIRCM_Dividendes(t *testing.T) {
	res := calc.CalcIRCM(2_000_000, "DIVIDENDES")
	if res.Taux != 0.125 {
		t.Errorf("Taux DIVIDENDES = %v, want 0.125", res.Taux)
	}
	if res.IRCM != 250_000 {
		t.Errorf("IRCM DIVIDENDES = %v, want 250000", res.IRCM)
	}
}

func TestCalcIRCM_InconuFallback(t *testing.T) {
	res := calc.CalcIRCM(1_000_000, "INCONNU")
	// Fallback : CREANCES (25%)
	if res.Taux != 0.25 {
		t.Errorf("Fallback IRCM taux = %v, want 0.25", res.Taux)
	}
}

func TestCalcIRCM_NetCoherent(t *testing.T) {
	for _, typ := range []string{"CREANCES", "OBLIGATIONS", "DIVIDENDES"} {
		res := calc.CalcIRCM(500_000, typ)
		if math.Abs(res.Brut-res.IRCM-res.Net) > 1 {
			t.Errorf("[%s] Brut(%v) - IRCM(%v) ≠ Net(%v)", typ, res.Brut, res.IRCM, res.Net)
		}
	}
}

// --- IS / MFP --------------------------------------------------

func TestCalcIS_Taux27_5(t *testing.T) {
	res := calc.CalcIS(100_000_000, false)
	want := math.Round(100_000_000 * 0.275)
	if res.IS != want {
		t.Errorf("IS = %v, want %v", res.IS, want)
	}
}

func TestCalcIS_AvecCGA(t *testing.T) {
	// Réduction CGA de 30% sur IS
	resSans := calc.CalcIS(100_000_000, false)
	resAvec := calc.CalcIS(100_000_000, true)
	if resAvec.IS >= resSans.IS {
		t.Errorf("IS avec CGA (%v) doit être < sans CGA (%v)", resAvec.IS, resSans.IS)
	}
	expected := math.Round(resSans.IS * (1 - 0.30))
	if resAvec.IS != expected {
		t.Errorf("IS avec CGA = %v, want %v", resAvec.IS, expected)
	}
}

func TestCalcIS_Zero(t *testing.T) {
	res := calc.CalcIS(0, false)
	if res.IS != 0 {
		t.Errorf("IS(0) = %v, want 0", res.IS)
	}
}

func TestCalcMFP_MinimumRNI(t *testing.T) {
	// Très faible CA → MFP minimum RNI = 1 000 000 FCFA
	res := calc.CalcMFP(10_000, "RNI", false)
	if res.MFPDu != res.MFPMinimum {
		t.Errorf("MFP minimum RNI = %v, want %v", res.MFPDu, res.MFPMinimum)
	}
	if res.MFPMinimum != 1_000_000 {
		t.Errorf("MFP minimum RNI = %v, want 1000000", res.MFPMinimum)
	}
}

func TestCalcMFP_MinimumRSI(t *testing.T) {
	res := calc.CalcMFP(10_000, "RSI", false)
	if res.MFPMinimum != 300_000 {
		t.Errorf("MFP minimum RSI = %v, want 300000", res.MFPMinimum)
	}
}

func TestCalcMFP_AvecCGA(t *testing.T) {
	resSans := calc.CalcMFP(1_000_000_000, "RNI", false) // Gros CA pour dépasser minimum
	resAvec := calc.CalcMFP(1_000_000_000, "RNI", true)
	if resAvec.MFPDu >= resSans.MFPDu {
		t.Errorf("MFP avec CGA (%v) doit être < sans CGA (%v)", resAvec.MFPDu, resSans.MFPDu)
	}
}

// --- CME -------------------------------------------------------

func TestCalcCME_ZoneA_Classe8(t *testing.T) {
	// CA ≤ 1 500 000 → classe 8
	res := calc.CalcCME(1_000_000, "A", false)
	if res.Classe != 8 {
		t.Errorf("Classe CME = %v, want 8", res.Classe)
	}
	if res.CME != 10_000 {
		t.Errorf("CME Zone A Classe 8 = %v, want 10000", res.CME)
	}
}

func TestCalcCME_ZoneA_Classe1(t *testing.T) {
	// CA > 13 000 000 → classe 1
	res := calc.CalcCME(15_000_000, "A", false)
	if res.Classe != 1 {
		t.Errorf("Classe CME = %v, want 1", res.Classe)
	}
	if res.CME != 200_000 {
		t.Errorf("CME Zone A Classe 1 = %v, want 200000", res.CME)
	}
}

func TestCalcCME_ZoneD(t *testing.T) {
	res := calc.CalcCME(1_000_000, "D", false)
	if res.Zone != "D" {
		t.Errorf("Zone = %v, want D", res.Zone)
	}
	if res.CME != 2_000 {
		t.Errorf("CME Zone D Classe 8 = %v, want 2000", res.CME)
	}
}

func TestCalcCME_AvecCGA(t *testing.T) {
	resSans := calc.CalcCME(5_000_000, "A", false)
	resAvec := calc.CalcCME(5_000_000, "A", true)
	// CGA → réduction de 25%
	expected := math.Round(float64(resSans.CME) * 0.75)
	if resAvec.CMENet != expected {
		t.Errorf("CMENet avec CGA = %v, want %v", resAvec.CMENet, expected)
	}
}

func TestCalcCME_ZoneInconnueFallback(t *testing.T) {
	// Zone inconnue → zone A
	res := calc.CalcCME(1_000_000, "Z", false)
	if res.Zone != "Z" {
		t.Errorf("Zone = %v, want Z", res.Zone)
	}
	resA := calc.CalcCME(1_000_000, "A", false)
	if res.CME != resA.CME {
		t.Errorf("CME zone inconnue (%v) doit égaler zone A (%v)", res.CME, resA.CME)
	}
}

// --- PATENTE ---------------------------------------------------

func TestCalcPatente_TrancheBasse(t *testing.T) {
	// CA ≤ 5 000 000 → droits fixes 10 000 FCFA
	res := calc.CalcPatente(4_000_000, 0)
	if res.DroitFixe != 10_000 {
		t.Errorf("Droit fixe = %v, want 10000", res.DroitFixe)
	}
	if res.DroitProp != 0 {
		t.Errorf("Droit prop (VL=0) = %v, want 0", res.DroitProp)
	}
}

func TestCalcPatente_AvecValeurLocative(t *testing.T) {
	// CA 80M → entre 75M et 100M → droits fixes 220 000 + VL 2 400 000 × 1% = 24 000
	res := calc.CalcPatente(80_000_000, 2_400_000)
	if res.DroitFixe != 220_000 {
		t.Errorf("Droit fixe 80M = %v, want 220000", res.DroitFixe)
	}
	if res.DroitProp != 24_000 {
		t.Errorf("Droit prop = %v, want 24000", res.DroitProp)
	}
	if res.TotalPatente != 244_000 {
		t.Errorf("Total patente = %v, want 244000", res.TotalPatente)
	}
}

func TestCalcPatente_TranchePlafond(t *testing.T) {
	// CA > 500 000 000 → droits fixes 660 000 FCFA
	res := calc.CalcPatente(1_000_000_000, 0)
	if res.DroitFixe != 660_000 {
		t.Errorf("Droit fixe CA>500M = %v, want 660000", res.DroitFixe)
	}
}

// --- CNSS PATRONAL ---------------------------------------------

func TestCalcCNSSPatronal_CNSS(t *testing.T) {
	// Brute 200 000, CNSS → base = min(200k, 600k) = 200k
	// Sal : 200k × 5.5% = 11 000
	// Fam : 200k × 7.2% = 14 400, Acc : 200k × 3.4% = 6 800, Ret : 200k × 5.5% = 11 000
	// Pat : 14400 + 6800 + 11000 = 32 200, Global = 11000 + 32200 = 43 200
	res := calc.CalcCNSSPatronal(200_000, "CNSS")
	if res.CotSalariale != 11_000 {
		t.Errorf("CotSalariale CNSS = %v, want 11000", res.CotSalariale)
	}
	if res.Famille != 14_400 {
		t.Errorf("Famille = %v, want 14400", res.Famille)
	}
	if res.Accident != 6_800 {
		t.Errorf("Accident = %v, want 6800", res.Accident)
	}
	if res.TotalPatronal != 32_200 {
		t.Errorf("TotalPatronal = %v, want 32200", res.TotalPatronal)
	}
	if res.TotalGlobal != 43_200 {
		t.Errorf("TotalGlobal = %v, want 43200", res.TotalGlobal)
	}
}

func TestCalcCNSSPatronal_CARFO(t *testing.T) {
	// CARFO → 6% salariale
	res := calc.CalcCNSSPatronal(100_000, "CARFO")
	if res.CotSalariale != 6_000 {
		t.Errorf("CotSalariale CARFO = %v, want 6000", res.CotSalariale)
	}
}

func TestCalcCNSSPatronal_PlafondCNSS(t *testing.T) {
	// Salaire > 600 000 → base plafonnée
	res := calc.CalcCNSSPatronal(1_000_000, "CNSS")
	maxBase := 600_000.0
	expectedSal := math.Round(maxBase * 0.055)
	if res.CotSalariale != expectedSal {
		t.Errorf("CotSalariale plafond = %v, want %v", res.CotSalariale, expectedSal)
	}
}

// --- PÉNALITÉS DE RETARD ---------------------------------------

func TestCalcPenaliteRetard_1Mois(t *testing.T) {
	// 1 mois → 10% majoration + 1% intérêts = 11%, minimum 5 000
	res := calc.CalcPenaliteRetard(100_000, 1)
	if res.Majoration != 10_000 {
		t.Errorf("Majoration 1 mois = %v, want 10000", res.Majoration)
	}
	if res.Interets != 1_000 {
		t.Errorf("Interets 1 mois = %v, want 1000", res.Interets)
	}
	if res.TotalPenalite != 11_000 {
		t.Errorf("Total pénalité 1 mois = %v, want 11000", res.TotalPenalite)
	}
}

func TestCalcPenaliteRetard_3Mois(t *testing.T) {
	// 3 mois → (10% + 2×3%) = 16% maj + 3×1% = 3% intérêts = 19%
	res := calc.CalcPenaliteRetard(100_000, 3)
	if res.Majoration != 16_000 {
		t.Errorf("Majoration 3 mois = %v, want 16000", res.Majoration)
	}
	if res.Interets != 3_000 {
		t.Errorf("Interets 3 mois = %v, want 3000", res.Interets)
	}
}

func TestCalcPenaliteRetard_Minimum(t *testing.T) {
	// Très petit montant → plancher 5 000 FCFA
	res := calc.CalcPenaliteRetard(1_000, 1)
	if res.TotalPenalite < 5_000 {
		t.Errorf("Plancher minimum non respecté : %v < 5000", res.TotalPenalite)
	}
}

func TestCalcPenaliteRetard_ZeroMois(t *testing.T) {
	res := calc.CalcPenaliteRetard(500_000, 0)
	if res.TotalPenalite != 0 {
		t.Errorf("Pénalité 0 mois = %v, want 0", res.TotalPenalite)
	}
}

func TestCalcPenaliteRetard_TotalDu(t *testing.T) {
	res := calc.CalcPenaliteRetard(1_000_000, 2)
	expected := res.MontantDu + res.TotalPenalite
	if res.TotalDu != expected {
		t.Errorf("TotalDu = %v, want %v", res.TotalDu, expected)
	}
}

func TestCalcPenaliteRetard_Plafond(t *testing.T) {
	// Très long retard → plafond à 100% du montant dû
	res := calc.CalcPenaliteRetard(1_000_000, 100)
	if res.TotalPenalite > res.MontantDu {
		t.Errorf("Pénalité (%v) dépasse le plafond 100%% (%v)", res.TotalPenalite, res.MontantDu)
	}
}

// TestCalcPenaliteRetard_MajorationPlusInterets vérifie que les intérêts
// moratoires sont bien ajoutés à la majoration dans le total.
func TestCalcPenaliteRetard_MajorationPlusInterets(t *testing.T) {
	// 2 mois : majoration = 13 %, intérêts = 2 % → total = 15 %
	res := calc.CalcPenaliteRetard(100_000, 2)
	wantMaj := 13_000.0   // 100k × (10%+3%)
	wantInt := 2_000.0    // 100k × 1% × 2 mois
	wantTotal := 15_000.0 // majoration + intérêts
	if res.Majoration != wantMaj {
		t.Errorf("Majoration 2 mois = %v, want %v", res.Majoration, wantMaj)
	}
	if res.Interets != wantInt {
		t.Errorf("Interets 2 mois = %v, want %v", res.Interets, wantInt)
	}
	if res.TotalPenalite != wantTotal {
		t.Errorf("TotalPenalite 2 mois = %v, want %v", res.TotalPenalite, wantTotal)
	}
}

// TestCalcPenaliteRetard_EntierFCFA vérifie que le résultat est toujours entier.
func TestCalcPenaliteRetard_EntierFCFA(t *testing.T) {
	cases := []struct {
		montant float64
		mois    int
	}{
		{123_456, 2}, {77_777, 5}, {999_999, 1}, {500_001, 3},
	}
	for _, c := range cases {
		res := calc.CalcPenaliteRetard(c.montant, c.mois)
		if res.TotalPenalite != math.Round(res.TotalPenalite) {
			t.Errorf("TotalPenalite(%.0f, %d) = %v - pas entier (FCFA indivisible)",
				c.montant, c.mois, res.TotalPenalite)
		}
	}
}

// --- SMIG ------------------------------------------------------

func TestSMIG_Positif(t *testing.T) {
	if calc.SMIG <= 0 {
		t.Errorf("SMIG doit être > 0, got %v", calc.SMIG)
	}
}

func TestSMIG_Valeur2025(t *testing.T) {
	// SMIG BF = 34 664 FCFA/mois (arrêté 2023, en vigueur 2025)
	if calc.SMIG != 34_664 {
		t.Errorf("SMIG = %v, want 34664", calc.SMIG)
	}
}
