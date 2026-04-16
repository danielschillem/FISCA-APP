package calc

import "math"

// ─── CNSS PATRONAL ────────────────────────────────────────────
// CGI 2025 / Code Travail BF

const (
	cnssPatFamille  = 0.072 // Allocations familiales 7,2 %
	cnssPatAccident = 0.034 // Accidents du travail 3,4 %
	cnssPatRetraite = 0.055 // Retraite part patronale (même taux que salariale)
)

type CNSSPatronalResult struct {
	RemBrute      float64
	BasePlafond   float64
	CotSalariale  float64 // part salariale (5,5 ou 6 %)
	Famille       float64
	Accident      float64
	Retraite      float64
	TotalPatronal float64
	TotalGlobal   float64
}

// CalcCNSSPatronal calcule les cotisations patronales CNSS pour un salarié.
func CalcCNSSPatronal(remBrute float64, cotisation string) CNSSPatronalResult {
	base := math.Min(remBrute, cnssPlafond)

	// Cotisation salariale
	var cotTaux float64
	if cotisation == "CARFO" {
		cotTaux = carfoTaux
	} else {
		cotTaux = cnssTaux
	}
	cotSal := math.Round(base * cotTaux)

	// Part patronale
	famille := math.Round(base * cnssPatFamille)
	accident := math.Round(base * cnssPatAccident)
	retraite := math.Round(base * cnssPatRetraite)
	totalPat := famille + accident + retraite

	return CNSSPatronalResult{
		RemBrute:      math.Round(remBrute),
		BasePlafond:   base,
		CotSalariale:  cotSal,
		Famille:       famille,
		Accident:      accident,
		Retraite:      retraite,
		TotalPatronal: totalPat,
		TotalGlobal:   cotSal + totalPat,
	}
}

// ─── TVA — CGI 2025 Art. 317 ──────────────────────────────────

const (
	TVATauxStandard   = 0.18
	TVATauxHotellerie = 0.10
	TVASeuilAssujetti = 50_000_000.0
)

type TVAResult struct {
	HT  float64
	TVA float64
	TTC float64
}

// CalcTVA calcule la TVA sur un montant HT.
func CalcTVA(montantHT, taux float64) TVAResult {
	tva := math.Round(montantHT * taux)
	return TVAResult{HT: montantHT, TVA: tva, TTC: montantHT + tva}
}

// CalcTVAFromTTC extrait le HT depuis un TTC.
func CalcTVAFromTTC(montantTTC, taux float64) TVAResult {
	ht := math.Round(montantTTC / (1 + taux))
	tva := montantTTC - ht
	return TVAResult{HT: ht, TVA: tva, TTC: montantTTC}
}

type TVALigneInput struct {
	TypeOp    string // "collecte" | "deductible"
	MontantHT float64
	Taux      float64
}

type SoldeTVA struct {
	Collectee   float64
	Deductible  float64
	Solde       float64
	AVerser     float64
	ARembourser float64
}

// CalcSoldeTVA calcule le solde TVA d'une période.
func CalcSoldeTVA(lignes []TVALigneInput) SoldeTVA {
	var collectee, deductible float64
	for _, l := range lignes {
		taux := l.Taux
		if taux == 0 {
			taux = TVATauxStandard
		}
		r := CalcTVA(l.MontantHT, taux)
		if l.TypeOp == "collecte" {
			collectee += r.TVA
		} else {
			deductible += r.TVA
		}
	}
	solde := math.Round(collectee - deductible)
	aVerser := math.Max(0, solde)
	aRemb := math.Max(0, -solde)
	return SoldeTVA{
		Collectee:   math.Round(collectee),
		Deductible:  math.Round(deductible),
		Solde:       solde,
		AVerser:     aVerser,
		ARembourser: aRemb,
	}
}

// ─── RAS — CGI 2025 Art. 206–226 ──────────────────────────────

// Taux RAS par type de prestataire
var rasTaux = map[string]float64{
	"RESIDENT_IFU":        0.05,
	"RESIDENT_IFU_IMMO":   0.01,
	"RESIDENT_SANS_IFU":   0.25,
	"TRAVAIL_TEMPORAIRE":  0.02,
	"NON_RESIDENT":        0.20,
	"NON_RESIDENT_CEDEAO": 0.10,
	"NONDETER_VACATION":   0.02,
	"NONDETER_PUBLIC":     0.05,
	"NONDETER_SALARIE":    0.10,
	"COMMANDE_PUBLIQUE":   0.05,
	"COMMANDE_PUB_BIENS":  0.01,
}

// Types sans seuil d'exonération
var rasNoSeuil = map[string]bool{
	"NON_RESIDENT":        true,
	"NON_RESIDENT_CEDEAO": true,
	"NONDETER_VACATION":   true,
	"NONDETER_PUBLIC":     true,
	"NONDETER_SALARIE":    true,
}

const rasSeuilImposition = 50_000.0

type RASResult struct {
	HT      float64
	RAS     float64
	Net     float64
	Taux    float64
	Exonere bool
}

// CalcRAS calcule la retenue à la source sur un montant HT.
func CalcRAS(montantHT float64, typeKey string) RASResult {
	taux, ok := rasTaux[typeKey]
	if !ok {
		taux = rasTaux["RESIDENT_IFU"]
	}
	exonere := !rasNoSeuil[typeKey] && montantHT < rasSeuilImposition
	var ras float64
	if !exonere {
		ras = math.Round(montantHT * taux)
	}
	return RASResult{HT: montantHT, RAS: ras, Net: montantHT - ras, Taux: taux, Exonere: exonere}
}

// ─── IRF — CGI 2025 Art. 121–126 ──────────────────────────────

type IRFResult struct {
	LoyerBrut    float64
	Abattement   float64
	BaseNette    float64
	IRF1         float64
	IRF2         float64
	IRFTotal     float64
	LoyerNet     float64
	TauxEffectif float64
}

// CalcIRF calcule l'IRF sur un loyer brut mensuel.
func CalcIRF(loyerBrut float64) IRFResult {
	abatt := math.Round(loyerBrut * 0.50)
	base := loyerBrut - abatt

	var irf1, irf2 float64
	seuil := 100_000.0
	if base <= seuil {
		irf1 = math.Round(base * 0.18)
	} else {
		irf1 = math.Round(seuil * 0.18)
		irf2 = math.Round((base - seuil) * 0.25)
	}
	total := irf1 + irf2
	var tauxEff float64
	if loyerBrut > 0 {
		tauxEff = math.Round((total/loyerBrut)*10000) / 100
	}
	return IRFResult{
		LoyerBrut:    loyerBrut,
		Abattement:   abatt,
		BaseNette:    base,
		IRF1:         irf1,
		IRF2:         irf2,
		IRFTotal:     total,
		LoyerNet:     loyerBrut - total,
		TauxEffectif: tauxEff,
	}
}

// ─── IRCM — CGI 2025 Art. 140 ─────────────────────────────────

var ircmTaux = map[string]float64{
	"CREANCES":    0.25,
	"OBLIGATIONS": 0.06,
	"DIVIDENDES":  0.125,
}

type IRCMResult struct {
	Brut float64
	IRCM float64
	Net  float64
	Taux float64
}

// CalcIRCM calcule l'IRCM sur un revenu de capital mobilier.
func CalcIRCM(montantBrut float64, typeRevenu string) IRCMResult {
	taux, ok := ircmTaux[typeRevenu]
	if !ok {
		taux = ircmTaux["CREANCES"]
	}
	ircm := math.Round(montantBrut * taux)
	return IRCMResult{Brut: montantBrut, IRCM: ircm, Net: montantBrut - ircm, Taux: taux}
}

// ─── IS / MFP — CGI 2025 Art. 42 ─────────────────────────────

const (
	isTaux          = 0.275
	mfpTaux         = 0.005
	mfpMinRNI       = 1_000_000.0
	mfpMinRSI       = 300_000.0
	cgaReductionIS  = 0.30
	cgaReductionMFP = 0.50
)

type ISResult struct {
	Benefice float64
	IS       float64
}

// CalcIS calcule l'IS/IBICA sur un bénéfice imposable.
func CalcIS(benefice float64, adhesionCGA bool) ISResult {
	is := math.Round(benefice * isTaux)
	if adhesionCGA {
		is = math.Round(is * (1 - cgaReductionIS))
	}
	return ISResult{Benefice: benefice, IS: is}
}

type MFPResult struct {
	CA         float64
	MFPCalcule float64
	MFPMinimum float64
	MFPDu      float64
}

// CalcMFP calcule le minimum forfaitaire de perception.
func CalcMFP(caHT float64, regime string, adhesionCGA bool) MFPResult {
	mfpCalc := math.Round(caHT * mfpTaux)
	var minimum float64
	if regime == "RSI" {
		minimum = mfpMinRSI
	} else {
		minimum = mfpMinRNI
	}
	mfpDu := math.Max(mfpCalc, minimum)
	if adhesionCGA {
		mfpDu = math.Round(mfpDu * (1 - cgaReductionMFP))
	}
	return MFPResult{CA: caHT, MFPCalcule: mfpCalc, MFPMinimum: minimum, MFPDu: mfpDu}
}

// ─── CME — CGI 2025 Art. 533 ──────────────────────────────────

var cmeTarifs = map[string][8]float64{
	"A": {200000, 160000, 120000, 80000, 60000, 30000, 20000, 10000},
	"B": {160000, 120000, 80000, 60000, 42000, 20000, 12000, 6000},
	"C": {120000, 80000, 54000, 42000, 30000, 12000, 9000, 2500},
	"D": {80000, 48000, 30000, 18000, 14000, 6000, 3500, 2000},
}

var cmeTranches = []struct {
	max    float64
	classe int
}{
	{1_500_000, 8},
	{3_000_000, 7},
	{5_000_000, 6},
	{7_000_000, 5},
	{9_000_000, 4},
	{11_000_000, 3},
	{13_000_000, 2},
	{15_000_000, 1},
}

// GetClasseCME détermine la classe CME selon le CA annuel.
func GetClasseCME(ca float64) int {
	for _, t := range cmeTranches {
		if ca <= t.max {
			return t.classe
		}
	}
	return 1
}

type CMEResult struct {
	CA     float64
	Zone   string
	Classe int
	CME    float64
	CMENet float64
}

// CalcCME calcule la contribution des micro-entreprises.
func CalcCME(ca float64, zone string, adhesionCGA bool) CMEResult {
	if zone == "" {
		zone = "A"
	}
	tarifs, ok := cmeTarifs[zone]
	if !ok {
		tarifs = cmeTarifs["A"]
	}
	classe := GetClasseCME(ca)
	cme := tarifs[classe-1]
	cmeNet := cme
	if adhesionCGA {
		cmeNet = math.Round(cme * 0.75)
	}
	return CMEResult{CA: ca, Zone: zone, Classe: classe, CME: cme, CMENet: cmeNet}
}

// ─── PATENTES — CGI 2025 Art. 237–240 ────────────────────────

var patenteTableauA = []struct {
	max   float64
	droit float64
}{
	{5_000_000, 10_000},
	{7_000_000, 15_000},
	{10_000_000, 25_000},
	{15_000_000, 40_000},
	{20_000_000, 60_000},
	{30_000_000, 85_000},
	{50_000_000, 120_000},
	{75_000_000, 170_000},
	{100_000_000, 220_000},
	{150_000_000, 280_000},
	{200_000_000, 350_000},
	{300_000_000, 430_000},
	{500_000_000, 530_000},
	{math.Inf(1), 660_000},
}

// Droit proportionnel : 1 % sur la valeur locative des locaux professionnels
const patenteProportionnel = 0.01

type PatenteResult struct {
	CA             float64
	DroitFixe      float64
	ValeurLocative float64
	DroitProp      float64
	TotalPatente   float64
}

// CalcPatente calcule la contribution des patentes.
func CalcPatente(ca, valeurLocative float64) PatenteResult {
	var droitFixe float64
	for _, t := range patenteTableauA {
		if ca <= t.max {
			droitFixe = t.droit
			break
		}
	}
	droitProp := math.Round(valeurLocative * patenteProportionnel)
	return PatenteResult{
		CA:             ca,
		DroitFixe:      droitFixe,
		ValeurLocative: valeurLocative,
		DroitProp:      droitProp,
		TotalPatente:   droitFixe + droitProp,
	}
}

// ─── PÉNALITÉS DE RETARD — CGI 2025 Art. 607 ────────────────

const (
	penaliteBase     = 0.10 // Majoration 1er mois : 10 %
	penaliteSupp     = 0.03 // Majoration mois suivants : 3 %/mois
	penaliteIntMorat = 0.01 // Intérêt moratoire : 1 %/mois
	penaliteMin      = 5_000.0
	penaliteMax      = 1.00 // Plafond : 100 % du montant dû
)

type PenaliteResult struct {
	MontantDu     float64
	MoisRetard    int
	Majoration    float64 // 10% + 3%/mois supp
	Interets      float64 // 1%/mois × nb mois
	TotalPenalite float64
	TotalDu       float64 // MontantDu + TotalPenalite
}

// CalcPenaliteRetard calcule les pénalités de retard IUTS/TPA selon CGI 2025 Art. 607.
// moisRetard = nombre de mois de retard (1 = dépôt avec 1 mois de retard).
func CalcPenaliteRetard(montantDu float64, moisRetard int) PenaliteResult {
	if moisRetard <= 0 || montantDu <= 0 {
		return PenaliteResult{MontantDu: montantDu}
	}

	// Majoration : 10% 1er mois + 3% par mois supplémentaire
	tauxMaj := penaliteBase + float64(moisRetard-1)*penaliteSupp
	if tauxMaj > penaliteMax {
		tauxMaj = penaliteMax
	}
	majoration := math.Round(montantDu * tauxMaj)

	// Intérêts moratoires : 1% par mois
	interets := math.Round(montantDu * penaliteIntMorat * float64(moisRetard))

	total := majoration + interets
	// Plafond : ne peut pas dépasser le montant dû initial
	if total > montantDu*penaliteMax {
		total = math.Round(montantDu * penaliteMax)
	}
	// Plancher minimum (s'applique même si total < minimum, sauf si total déjà >= minimum)
	if total < penaliteMin {
		total = penaliteMin
	}

	return PenaliteResult{
		MontantDu:     montantDu,
		MoisRetard:    moisRetard,
		Majoration:    majoration,
		Interets:      interets,
		TotalPenalite: total,
		TotalDu:       montantDu + total,
	}
}
