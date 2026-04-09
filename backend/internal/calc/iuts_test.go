// FISCA — Backend Go Tests

package calc_test

import (
	"testing"

	"github.com/fisca-app/backend/internal/calc"
)

func TestCalcIUTS_ExonereZero(t *testing.T) {
	got := calc.CalcIUTS(0)
	if got != 0 {
		t.Errorf("CalcIUTS(0) = %v, want 0", got)
	}
}

func TestCalcIUTS_PremiereTranche(t *testing.T) {
	// 30 000 FCFA → taux 0%, IUTS = 0
	got := calc.CalcIUTS(30000)
	if got != 0 {
		t.Errorf("CalcIUTS(30000) = %v, want 0", got)
	}
}

func TestCalcIUTS_DeuxiemeTranche(t *testing.T) {
	// 50 000 FCFA → 0% sur 30k + 12% sur 20k = 2 400
	got := calc.CalcIUTS(50000)
	if got != 2400 {
		t.Errorf("CalcIUTS(50000) = %v, want 2400", got)
	}
}

func TestCalcSalarie_BasiqueNonCadre(t *testing.T) {
	e := calc.SalarieInput{
		SalaireBase: 95000,
		Anciennete:  4750,
		HeuresSup:   0,
		Logement:    20000,
		Transport:   15000,
		Fonction:    0,
		Charges:     0,
		Cotisation:  "CNSS",
	}
	res := calc.CalcSalarie(e)

	if res.BrutTotal != 134750 {
		t.Errorf("BrutTotal = %v, want 134750", res.BrutTotal)
	}
	if res.CotSoc <= 0 {
		t.Errorf("CotSoc should be > 0, got %v", res.CotSoc)
	}
	if res.IUTSNet < 0 {
		t.Errorf("IUTSNet should be >= 0, got %v", res.IUTSNet)
	}
	if res.SalaireNet > res.BrutTotal {
		t.Errorf("SalaireNet (%v) should not exceed BrutTotal (%v)", res.SalaireNet, res.BrutTotal)
	}
}

func TestCalcSalarie_CARFO(t *testing.T) {
	e := calc.SalarieInput{
		SalaireBase: 200000,
		Anciennete:  10000,
		Cotisation:  "CARFO",
	}
	res := calc.CalcSalarie(e)
	expected := (200000 + 10000) * 0.06
	if res.CotSoc != expected {
		t.Errorf("CotSoc CARFO = %v, want %v", res.CotSoc, expected)
	}
}

// TestCalcSalarie_AbattementFamilialCap vérifie que l'abattement familial
// ne dépasse pas 40% de l'IUTS brut, même avec un grand nombre de charges.
func TestCalcSalarie_AbattementFamilialCap(t *testing.T) {
	// Salarié avec 100 charges déclarées → abattement théorique = 100 000 FCFA
	// On s'assure que l'IUTS net >= 60% de l'IUTS brut (plafond 40% respecté)
	e := calc.SalarieInput{
		SalaireBase: 150000,
		Anciennete:  0,
		Charges:     100, // 100 × 1 000 = 100 000 FCFA d'abattement théorique
		Cotisation:  "CNSS",
	}
	res := calc.CalcSalarie(e)
	// L'abattement réel ne peut pas dépasser 40% de IUTSBrut
	maxAllowed := res.IUTSBrut * 0.40
	actualAbatt := res.IUTSBrut - res.IUTSNet
	if actualAbatt > maxAllowed+0.01 { // +0.01 pour tolérance d'arrondi
		t.Errorf("Abattement familial (%v) dépasse le plafond 40%% de IUTSBrut (%v), max autorisé = %v",
			actualAbatt, res.IUTSBrut, maxAllowed)
	}
}

// TestCalcIUTS_HauteTranche vérifie le calcul sur un salaire élevé (tranche 30%).
func TestCalcIUTS_HauteTranche(t *testing.T) {
	// Base imposable = 700 000 FCFA
	// Tranches :
	//   0–30k     :    0
	//   30–50k    : 20k × 12% =  2 400
	//   50–80k    : 30k × 14% =  4 200
	//   80–120k   : 40k × 16% =  6 400
	//   120–170k  : 50k × 18% =  9 000
	//   170–250k  : 80k × 20% = 16 000
	//   250–400k  :150k × 24% = 36 000
	//   400–600k  :200k × 28% = 56 000
	//   600–700k  :100k × 30% = 30 000
	//   Total = 160 000
	got := calc.CalcIUTS(700000)
	want := 160000.0
	if got != want {
		t.Errorf("CalcIUTS(700000) = %v, want %v", got, want)
	}
}
