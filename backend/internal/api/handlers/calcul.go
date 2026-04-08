package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/fisca-app/backend/internal/calc"
	"github.com/fisca-app/backend/internal/models"
)

type CalculHandler struct{}

func NewCalculHandler() *CalculHandler { return &CalculHandler{} }

// POST /api/calcul
func (h *CalculHandler) Calcul(w http.ResponseWriter, r *http.Request) {
	var req models.CalculRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}

	res := calc.CalcSalarie(calc.SalarieInput{
		SalaireBase: req.SalaireBase,
		Anciennete:  req.Anciennete,
		HeuresSup:   req.HeuresSup,
		Logement:    req.Logement,
		Transport:   req.Transport,
		Fonction:    req.Fonction,
		Charges:     req.Charges,
		Cotisation:  req.Cotisation,
	})

	jsonOK(w, models.CalculResult{
		BrutTotal:  res.BrutTotal,
		BaseImp:    res.BaseImp,
		IUTSBrut:   res.IUTSBrut,
		IUTSNet:    res.IUTSNet,
		CotSoc:     res.CotSoc,
		TPA:        res.TPA,
		SalaireNet: res.SalaireNet,
	})
}
