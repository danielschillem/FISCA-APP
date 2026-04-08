package calc

import "math"

// Barème IUTS mensuel — Code des impôts Burkina Faso, LF 2020

type tranche struct {
	plafond float64
	taux    float64
}

var iutsTranches = []tranche{
	{30000, 0.00},
	{50000, 0.12},
	{80000, 0.14},
	{120000, 0.16},
	{170000, 0.18},
	{250000, 0.20},
	{400000, 0.24},
	{600000, 0.28},
	{math.Inf(1), 0.30},
}

const (
	cnssTaux     = 0.055
	cnssPlafond  = 600000
	carfoTaux    = 0.06
	carfoPlafond = 600000
	tpaTaux      = 0.03
	abattForfait = 0.20
	exoLogement  = 75000
	exoTransport = 30000
	exoFonction  = 50000
	abattCharge  = 1000
	maxAbattFamP = 0.40
)

// CalcIUTS calcule l'IUTS brut progressif sur la base imposable.
func CalcIUTS(baseImp float64) float64 {
	impot := 0.0
	prev := 0.0
	for _, t := range iutsTranches {
		if baseImp <= prev {
			break
		}
		trancheVal := math.Min(baseImp, t.plafond) - prev
		impot += trancheVal * t.taux
		prev = t.plafond
	}
	return math.Round(impot)
}

type SalarieInput struct {
	SalaireBase float64
	Anciennete  float64
	HeuresSup   float64
	Logement    float64
	Transport   float64
	Fonction    float64
	Charges     int
	Cotisation  string // "CNSS" | "CARFO"
}

type SalarieResult struct {
	BrutTotal  float64
	BaseImp    float64
	IUTSBrut   float64
	IUTSNet    float64
	CotSoc     float64
	TPA        float64
	SalaireNet float64
}

// CalcSalarie effectue le calcul fiscal complet d'un salarié.
func CalcSalarie(e SalarieInput) SalarieResult {
	// 1. Brut total
	brutTotal := e.SalaireBase + e.Anciennete + e.HeuresSup +
		e.Logement + e.Transport + e.Fonction

	// 2. Cotisation sociale (part salariale)
	var cotTaux, cotPlafond float64
	if e.Cotisation == "CARFO" {
		cotTaux, cotPlafond = carfoTaux, carfoPlafond
	} else {
		cotTaux, cotPlafond = cnssTaux, cnssPlafond
	}
	baseCSS := math.Min(e.SalaireBase+e.Anciennete+e.HeuresSup, cotPlafond)
	cotSoc := math.Round(baseCSS * cotTaux)

	// 3. Exonérations accessoires
	exoLog := math.Min(e.Logement, exoLogement)
	exoTrans := math.Min(e.Transport, exoTransport)
	exoFonc := math.Min(e.Fonction, exoFonction)

	// 4. Abattement forfaitaire 20% sur salaire de base
	abatt := math.Round((e.SalaireBase + e.Anciennete + e.HeuresSup) * abattForfait)

	// 5. Base imposable
	baseImp := brutTotal - cotSoc - exoLog - exoTrans - exoFonc - abatt
	if baseImp < 0 {
		baseImp = 0
	}

	// 6. IUTS brut (tranches progressives)
	iutsBrut := CalcIUTS(baseImp)

	// 7. Abattement familial (1 000 FCFA × charges, plafonné à 40% IUTS brut)
	maxAbattFam := math.Round(iutsBrut * maxAbattFamP)
	abattFam := math.Min(float64(e.Charges)*abattCharge, maxAbattFam)

	// 8. IUTS net
	iutsNet := math.Max(0, iutsBrut-abattFam)

	// 9. TPA (sur brut soumis à CSS, patronale)
	tpa := math.Round(baseCSS * tpaTaux)

	// 10. Salaire net
	salaireNet := brutTotal - cotSoc - iutsNet

	return SalarieResult{
		BrutTotal:  math.Round(brutTotal),
		BaseImp:    math.Round(baseImp),
		IUTSBrut:   iutsBrut,
		IUTSNet:    iutsNet,
		CotSoc:     cotSoc,
		TPA:        tpa,
		SalaireNet: math.Round(salaireNet),
	}
}
