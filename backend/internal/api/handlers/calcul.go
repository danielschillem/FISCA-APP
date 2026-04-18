package handlers

import (
	"encoding/json"
	"math"
	"net/http"

	"github.com/fisca-app/backend/internal/calc"
	"github.com/fisca-app/backend/internal/models"
)

type CalculHandler struct{}

func NewCalculHandler() *CalculHandler { return &CalculHandler{} }

// validatePositive retourne une erreur si une des valeurs est négative ou NaN/Inf.
func validatePositive(vals ...float64) bool {
	for _, v := range vals {
		if v < 0 || math.IsNaN(v) || math.IsInf(v, 0) {
			return false
		}
	}
	return true
}

// POST /api/calcul
func (h *CalculHandler) Calcul(w http.ResponseWriter, r *http.Request) {
	var req models.CalculRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if !validatePositive(req.SalaireBase, req.Anciennete, req.HeuresSup, req.Logement, req.Transport, req.Fonction) {
		jsonError(w, "Les montants ne peuvent pas être négatifs ou invalides", http.StatusBadRequest)
		return
	}
	if req.Charges < 0 || req.Charges > 4 {
		jsonError(w, "Charges familiales : valeur entre 0 et 4 (CGI 2025 Art. 113)", http.StatusBadRequest)
		return
	}
	if req.Categorie != "Cadre" && req.Categorie != "Non-cadre" {
		req.Categorie = "Non-cadre"
	}
	if req.Cotisation != "CARFO" {
		req.Cotisation = "CNSS"
	}

	res := calc.CalcSalarie(calc.SalarieInput{
		SalaireBase: req.SalaireBase,
		Anciennete:  req.Anciennete,
		HeuresSup:   req.HeuresSup,
		Logement:    req.Logement,
		Transport:   req.Transport,
		Fonction:    req.Fonction,
		Charges:     req.Charges,
		Categorie:   req.Categorie,
		Cotisation:  req.Cotisation,
	})

	jsonOK(w, models.CalculResult{
		BrutTotal:    res.RemBrute,
		BaseImp:      res.BaseImp,
		IUTSBrut:     res.IUTSBrut,
		IUTSNet:      res.IUTSNet,
		CotSoc:       res.CotSoc,
		TPA:          res.TPA,
		FSP:          res.FSP,
		SalaireNet:   res.NetAPayer,
		AbattForf:    res.AbattForf,
		AbattFam:     res.AbattFam,
		RetPersonnel: res.FSP, // alias FSP - rétro-compat
	})
}

// POST /api/calcul/tva
func (h *CalculHandler) TVA(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MontantHT float64 `json:"montant_ht"`
		Taux      float64 `json:"taux"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if !validatePositive(req.MontantHT) {
		jsonError(w, "montant_ht invalide", http.StatusBadRequest)
		return
	}
	taux := req.Taux
	if taux == 0 {
		taux = calc.TVATauxStandard
	}
	if taux < 0 || taux > 100 {
		jsonError(w, "Taux TVA invalide (0-100)", http.StatusBadRequest)
		return
	}
	res := calc.CalcTVA(req.MontantHT, taux)
	jsonOK(w, res)
}

// POST /api/calcul/ras
func (h *CalculHandler) RAS(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MontantHT float64 `json:"montant_ht"`
		Type      string  `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if !validatePositive(req.MontantHT) {
		jsonError(w, "montant_ht invalide", http.StatusBadRequest)
		return
	}
	res := calc.CalcRAS(req.MontantHT, req.Type)
	jsonOK(w, res)
}

// POST /api/calcul/irf
func (h *CalculHandler) IRF(w http.ResponseWriter, r *http.Request) {
	var req struct {
		LoyerBrut float64 `json:"loyer_brut"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if !validatePositive(req.LoyerBrut) {
		jsonError(w, "loyer_brut invalide", http.StatusBadRequest)
		return
	}
	res := calc.CalcIRF(req.LoyerBrut)
	jsonOK(w, res)
}

// POST /api/calcul/ircm
func (h *CalculHandler) IRCM(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MontantBrut float64 `json:"montant_brut"`
		Type        string  `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if !validatePositive(req.MontantBrut) {
		jsonError(w, "montant_brut invalide", http.StatusBadRequest)
		return
	}
	res := calc.CalcIRCM(req.MontantBrut, req.Type)
	jsonOK(w, res)
}

// POST /api/calcul/is
func (h *CalculHandler) IS(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Benefice    float64 `json:"benefice"`
		AdhesionCGA bool    `json:"adhesion_cga"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if !validatePositive(req.Benefice) {
		jsonError(w, "benefice invalide", http.StatusBadRequest)
		return
	}
	res := calc.CalcIS(req.Benefice, req.AdhesionCGA)
	jsonOK(w, res)
}

// POST /api/calcul/mfp
func (h *CalculHandler) MFP(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CAHT        float64 `json:"ca_ht"`
		Regime      string  `json:"regime"`
		AdhesionCGA bool    `json:"adhesion_cga"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if !validatePositive(req.CAHT) {
		jsonError(w, "ca_ht invalide", http.StatusBadRequest)
		return
	}
	res := calc.CalcMFP(req.CAHT, req.Regime, req.AdhesionCGA)
	jsonOK(w, res)
}

// POST /api/calcul/cme
func (h *CalculHandler) CME(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CA          float64 `json:"ca"`
		Zone        string  `json:"zone"`
		AdhesionCGA bool    `json:"adhesion_cga"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if !validatePositive(req.CA) {
		jsonError(w, "ca invalide", http.StatusBadRequest)
		return
	}
	res := calc.CalcCME(req.CA, req.Zone, req.AdhesionCGA)
	jsonOK(w, res)
}

// POST /api/calcul/patente
func (h *CalculHandler) Patente(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CA             float64 `json:"ca"`
		ValeurLocative float64 `json:"valeur_locative"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if !validatePositive(req.CA, req.ValeurLocative) {
		jsonError(w, "ca ou valeur_locative invalide", http.StatusBadRequest)
		return
	}
	res := calc.CalcPatente(req.CA, req.ValeurLocative)
	jsonOK(w, res)
}

// POST /api/calcul/penalites
func (h *CalculHandler) Penalites(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MontantDu  float64 `json:"montant_du"`
		MoisRetard int     `json:"mois_retard"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	if !validatePositive(req.MontantDu) || req.MoisRetard < 0 || req.MoisRetard > 120 {
		jsonError(w, "montant_du ou mois_retard invalide", http.StatusBadRequest)
		return
	}
	jsonOK(w, calc.CalcPenaliteRetard(req.MontantDu, req.MoisRetard))
}
