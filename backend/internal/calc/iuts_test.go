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
