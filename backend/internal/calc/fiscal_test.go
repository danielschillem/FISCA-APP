// Tests unitaires Go — modules fiscaux manquants: IRF abattement, IS CGA, MFP, CME CGA/zone, Patente
package calc_test

import (
	"testing"

	"github.com/fisca-app/backend/internal/calc"
)

// ─── IRF — tests complémentaires ─────────────────────────────

func TestCalcIRF_Abattement50Pct(t *testing.T) {
	r := calc.CalcIRF(1_000_000)
	if r.Abattement != 500_000 {
		t.Errorf("Abattement = %.0f, want 500000", r.Abattement)
	}
}

func TestCalcIRF_LoyerNetCoherent(t *testing.T) {
	r := calc.CalcIRF(300_000)
	if r.LoyerNet != r.LoyerBrut-r.IRFTotal {
		t.Errorf("LoyerNet %.0f ≠ LoyerBrut-IRFTotal %.0f", r.LoyerNet, r.LoyerBrut-r.IRFTotal)
	}
}

func TestCalcIRF_TrancheBasse_Seulement18(t *testing.T) {
	// loyer=100k → base=50k ≤ 100k seuil → seul IRF1, IRF2=0
	r := calc.CalcIRF(100_000)
	if r.IRF2 != 0 {
		t.Errorf("IRF2 should be 0 for base ≤ 100k, got %.0f", r.IRF2)
	}
}

// ─── IS — réduction CGA ───────────────────────────────────────

func TestCalcIS_ReductionCGA30Pct(t *testing.T) {
	// 100M × 27.5% = 27 500 000 · × 70% = 19 250 000
	r := calc.CalcIS(100_000_000, true)
	if r.IS != 19_250_000 {
		t.Errorf("CalcIS(100M, CGA).IS = %.0f, want 19250000", r.IS)
	}
}

// ─── MFP — tests complets ─────────────────────────────────────

func TestCalcMFP_ReelMinimum1M(t *testing.T) {
	// CA=10M → 0.5%=50k < minimum 1M → MFPDu=1M
	r := calc.CalcMFP(10_000_000, "reel", false)
	if r.MFPDu != 1_000_000 {
		t.Errorf("MFPDu reel minimum = %.0f, want 1000000", r.MFPDu)
	}
}

func TestCalcMFP_RSIMinimum300k(t *testing.T) {
	r := calc.CalcMFP(1_000_000, "RSI", false)
	if r.MFPDu != 300_000 {
		t.Errorf("MFPDu RSI minimum = %.0f, want 300000", r.MFPDu)
	}
}

func TestCalcMFP_CalculDepasse(t *testing.T) {
	// CA=500M → 0.5%=2.5M > 1M → MFPDu=2.5M
	r := calc.CalcMFP(500_000_000, "reel", false)
	if r.MFPDu != 2_500_000 {
		t.Errorf("MFPDu CA=500M = %.0f, want 2500000", r.MFPDu)
	}
}

func TestCalcMFP_ReductionCGA50Pct(t *testing.T) {
	r := calc.CalcMFP(500_000_000, "reel", true)
	if r.MFPDu != 1_250_000 {
		t.Errorf("MFPDu (CGA) = %.0f, want 1250000", r.MFPDu)
	}
}

func TestCalcMFP_CalculeCoherent(t *testing.T) {
	r := calc.CalcMFP(400_000_000, "reel", false)
	if r.MFPCalcule != 2_000_000 {
		t.Errorf("MFPCalcule = %.0f, want 2000000", r.MFPCalcule)
	}
}

// ─── CME — réduction CGA + zones ─────────────────────────────

func TestCalcCME_ReductionCGA25Pct(t *testing.T) {
	r := calc.CalcCME(15_000_000, "A", true)
	want := 200_000.0 * 0.75
	if r.CMENet != want {
		t.Errorf("CMENet CGA = %.0f, want %.0f", r.CMENet, want)
	}
}

func TestCalcCME_ZoneD_Inferieur_ZoneA(t *testing.T) {
	rA := calc.CalcCME(15_000_000, "A", false)
	rD := calc.CalcCME(15_000_000, "D", false)
	if rD.CME >= rA.CME {
		t.Errorf("Zone D (%.0f) devrait être < Zone A (%.0f)", rD.CME, rA.CME)
	}
}

func TestCalcCME_SansCGA_NetEgalBrut(t *testing.T) {
	r := calc.CalcCME(5_000_000, "B", false)
	if r.CME != r.CMENet {
		t.Errorf("Sans CGA: CME (%.0f) devrait égaler CMENet (%.0f)", r.CME, r.CMENet)
	}
}

// ─── Patente — tests complets ─────────────────────────────────

func TestCalcPatente_DroitFixe_CA5M(t *testing.T) {
	r := calc.CalcPatente(5_000_000, 0)
	if r.DroitFixe != 10_000 {
		t.Errorf("DroitFixe CA=5M = %.0f, want 10000", r.DroitFixe)
	}
}

func TestCalcPatente_DroitFixe_CA200M(t *testing.T) {
	r := calc.CalcPatente(200_000_000, 0)
	if r.DroitFixe != 350_000 {
		t.Errorf("DroitFixe CA=200M = %.0f, want 350000", r.DroitFixe)
	}
}

func TestCalcPatente_DroitProp1Pct(t *testing.T) {
	// VL=1 200 000 → 1% = 12 000
	r := calc.CalcPatente(5_000_000, 1_200_000)
	if r.DroitProp != 12_000 {
		t.Errorf("DroitProp = %.0f, want 12000", r.DroitProp)
	}
}

func TestCalcPatente_TotalCoherent(t *testing.T) {
	r := calc.CalcPatente(20_000_000, 2_400_000)
	if r.TotalPatente != r.DroitFixe+r.DroitProp {
		t.Errorf("TotalPatente = %.0f ≠ DroitFixe+DroitProp = %.0f",
			r.TotalPatente, r.DroitFixe+r.DroitProp)
	}
}

func TestCalcPatente_DroitFixeCroissant(t *testing.T) {
	r1 := calc.CalcPatente(5_000_000, 0)
	r2 := calc.CalcPatente(100_000_000, 0)
	if r2.DroitFixe <= r1.DroitFixe {
		t.Errorf("DroitFixe devrait croître avec le CA")
	}
}
