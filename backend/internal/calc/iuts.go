package calc

import "math"

// --- BARÈME IUTS MENSUEL - CGI 2025 (Art. 112) ---------------
// 9 tranches progressives, taux max 30 %

type tranche struct {
	plafond float64
	taux    float64
}

var iutsTranches = []tranche{
	{30_000, 0.00},      //      0 →  30 000 :  0 %
	{50_000, 0.12},      //  30 001 →  50 000 : 12 %
	{80_000, 0.14},      //  50 001 →  80 000 : 14 %
	{120_000, 0.16},     //  80 001 → 120 000 : 16 %
	{170_000, 0.18},     // 120 001 → 170 000 : 18 %
	{250_000, 0.20},     // 170 001 → 250 000 : 20 %
	{400_000, 0.24},     // 250 001 → 400 000 : 24 %
	{600_000, 0.28},     // 400 001 → 600 000 : 28 %
	{math.Inf(1), 0.30}, // 600 001 +         : 30 %
}

// Abattement forfaitaire CGI 2025 Art. 111
// SMIG mensuel Burkina Faso (arrêté 2023, en vigueur 2025)
// Réservé pour future utilisation (exonération plancher SMIG, non encore codifiée dans CGI 2025).
const SMIG = 34_664.0 // FCFA/mois

const (
	abattForfaitCadre    = 0.20 // catégories cadres
	abattForfaitNonCadre = 0.25 // autres employés
)

// Abattement familial CGI 2025 Art. 113 - % de réduction sur IUTS brut
var abattFamilialTaux = map[int]float64{
	0: 0.00,
	1: 0.08, // 8 %
	2: 0.10, // 10 %
	3: 0.12, // 12 %
	4: 0.14, // 14 %
}

const (
	cnssTaux     = 0.055
	cnssPlafond  = 600000
	carfoTaux    = 0.06
	carfoPlafond = 600000
	tpaTaux      = 0.03
	// Exonérations accessoires mensuelles
	exoLogement  = 75000
	exoTransport = 30000
	exoFonction  = 50000
	// FSP - Fonds de Soutien Patriotique (décret présidentiel BF 2023)
	// 1 % prélevé sur le salaire net (brute − IUTS − CNSS) de tout salarié BF.
	// Non codifié dans le CGI mais obligatoire et à faire figurer sur le bulletin.
	fspTaux    = 0.01
	maxCharges = 4
)

// CalcIUTS calcule l'IUTS brut progressif sur la base imposable (CGI 2025 Art. 112).
func CalcIUTS(baseImp float64) float64 {
	if baseImp <= 0 {
		return 0
	}
	impot := 0.0
	prev := 0.0
	for _, t := range iutsTranches {
		if baseImp <= prev {
			break
		}
		trancheVal := math.Min(baseImp, t.plafond) - prev
		impot += trancheVal * t.taux
		prev = t.plafond
		if math.IsInf(t.plafond, 1) {
			break
		}
	}
	return math.Round(impot)
}

// getTauxAbattForfait retourne le taux selon la catégorie (CGI 2025 Art. 111).
func getTauxAbattForfait(categorie string) float64 {
	if categorie == "Cadre" {
		return abattForfaitCadre
	}
	return abattForfaitNonCadre
}

// calcAbattFamilial - réduction en % sur IUTS brut (CGI 2025 Art. 113).
func calcAbattFamilial(iutsBrut float64, charges int) float64 {
	n := charges
	if n > maxCharges {
		n = maxCharges
	}
	if n < 0 {
		n = 0
	}
	taux := abattFamilialTaux[n]
	return math.Round(iutsBrut * taux)
}

// SalarieInput contient les données d'un salarié pour le calcul fiscal.
type SalarieInput struct {
	SalaireBase float64
	Anciennete  float64
	HeuresSup   float64
	Logement    float64
	Transport   float64
	Fonction    float64
	Charges     int
	Categorie   string // "Cadre" | "Non-cadre"
	Cotisation  string // "CNSS" | "CARFO"
}

// SalarieResult contient le détail complet du calcul.
type SalarieResult struct {
	RemBrute  float64
	CotSoc    float64
	TPA       float64
	ExoLog    float64
	ExoTrans  float64
	ExoFonct  float64
	TauxForf  float64
	AbattForf float64
	SNI       float64
	BaseImp   float64
	IUTSBrut  float64
	AbattFam  float64
	IUTSNet   float64
	// FSP - Fonds de Soutien Patriotique (1 % du salaire net avant FSP)
	FSP       float64
	NetAPayer float64
	// Compat anciens champs
	BrutTotal    float64
	SalaireNet   float64
	RetPersonnel float64 // alias FSP pour rétro-compatibilité
}

// CalcSalarie effectue le calcul fiscal complet (CGI 2025).
func CalcSalarie(e SalarieInput) SalarieResult {
	// 1. Rémunération brute totale
	remBrute := e.SalaireBase + e.Anciennete + e.HeuresSup +
		e.Logement + e.Transport + e.Fonction

	// 2. Cotisation sociale salariale (base plafonnée)
	var cotTaux, cotPlafond float64
	if e.Cotisation == "CARFO" {
		cotTaux, cotPlafond = carfoTaux, carfoPlafond
	} else {
		cotTaux, cotPlafond = cnssTaux, cnssPlafond
	}
	baseCot := math.Min(remBrute, cotPlafond)
	cotSoc := math.Round(baseCot * cotTaux)

	// 3. TPA patronale 3 % (Art. 229)
	tpa := math.Round(remBrute * tpaTaux)

	// 4. Exonérations plafonnées
	exoLog := math.Min(e.Logement, exoLogement)
	exoTrans := math.Min(e.Transport, exoTransport)
	exoFonct := math.Min(e.Fonction, exoFonction)

	// 5. Abattement forfaitaire (CGI 2025 Art. 111) - sur salaire de base
	tauxForf := getTauxAbattForfait(e.Categorie)
	abattForf := math.Round(e.SalaireBase * tauxForf)

	// 6. Salaire net imposable
	sni := remBrute - exoLog - exoTrans - exoFonct - cotSoc

	// 7. Base imposable
	baseImp := math.Max(0, sni-abattForf)

	// 8. IUTS brut (CGI 2025 Art. 112)
	iutsBrut := CalcIUTS(baseImp)

	// 9. Abattement familial (CGI 2025 Art. 113)
	abattFam := calcAbattFamilial(iutsBrut, e.Charges)
	iutsNet := math.Max(0, iutsBrut-abattFam)

	// 10. FSP - Fonds de Soutien Patriotique : 1 % du salaire net avant FSP
	// (décret présidentiel BF 2023 - obligatoire, figurant sur le bulletin de paie)
	netAvantFSP := remBrute - iutsNet - cotSoc
	fsp := math.Round(netAvantFSP * fspTaux)
	netAPayer := netAvantFSP - fsp

	return SalarieResult{
		RemBrute:  math.Round(remBrute),
		CotSoc:    cotSoc,
		TPA:       tpa,
		ExoLog:    exoLog,
		ExoTrans:  exoTrans,
		ExoFonct:  exoFonct,
		TauxForf:  tauxForf,
		AbattForf: abattForf,
		SNI:       math.Round(sni),
		BaseImp:   math.Round(baseImp),
		IUTSBrut:  iutsBrut,
		AbattFam:  abattFam,
		IUTSNet:   iutsNet,
		FSP:       fsp,
		NetAPayer: math.Round(netAPayer),
		// Compat
		BrutTotal:    math.Round(remBrute),
		SalaireNet:   math.Round(netAPayer),
		RetPersonnel: fsp, // alias pour rétro-compat
	}
}
