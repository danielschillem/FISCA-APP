package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
)

var (
	ifuRe  = regexp.MustCompile(`^\d{10}[A-Z]{2}$`)
	dateRe = regexp.MustCompile(`^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/\d{4}$`)
)

type ContribuableValidationHandler struct{}

func NewContribuableValidationHandler() *ContribuableValidationHandler {
	return &ContribuableValidationHandler{}
}

type fieldError struct {
	Annexe  string `json:"annexe"`
	Row     int    `json:"row"`
	Field   string `json:"field"`
	Message string `json:"message"`
}

type validationResponse struct {
	OK     bool         `json:"ok"`
	Errors []fieldError `json:"errors"`
}

type contribuableValidationRequest struct {
	Annexes struct {
		IUTS struct {
			Rows []struct {
				Nom      string `json:"nom"`
				SalaireB int64  `json:"salaireB"`
				Charges  int    `json:"charges"`
			} `json:"rows"`
		} `json:"iuts"`
		RSFON struct {
			Rows []struct {
				Identite string `json:"identite"`
				IFU      string `json:"ifu"`
				Loyer    int64  `json:"loyer"`
			} `json:"rows"`
		} `json:"rsfon"`
		RSLIB struct {
			Rows []struct {
				IFU            string  `json:"ifu"`
				Identification string  `json:"identification"`
				Adresse        string  `json:"adresse"`
				Nature         string  `json:"nature"`
				Date           string  `json:"date"`
				Montant        float64 `json:"montant"`
			} `json:"rows"`
		} `json:"rslib"`
		RSETR struct {
			Rows []struct {
				Nom      string  `json:"nom"`
				Activite string  `json:"activite"`
				Adresse  string  `json:"adresse"`
				Nature   string  `json:"nature"`
				Date     string  `json:"date"`
				Montant  float64 `json:"montant"`
			} `json:"rows"`
		} `json:"rsetr"`
		RSPRE struct {
			Rows []struct {
				IFU            string  `json:"ifu"`
				Identification string  `json:"identification"`
				Adresse        string  `json:"adresse"`
				Nature         string  `json:"nature"`
				Date           string  `json:"date"`
				Montant        float64 `json:"montant"`
			} `json:"rows"`
		} `json:"rspre"`
		RSTVA struct {
			Rows []struct {
				IFU            string  `json:"ifu"`
				Identification string  `json:"identification"`
				Adresse        string  `json:"adresse"`
				Nature         string  `json:"nature"`
				Date           string  `json:"date"`
				MontantTVA     float64 `json:"montantTVA"`
			} `json:"rows"`
		} `json:"rstva"`
		TVA struct {
			Deductible []struct {
				IFU        string  `json:"ifu"`
				Nom        string  `json:"nom"`
				Date       string  `json:"date"`
				HT         float64 `json:"ht"`
				TVAFacture float64 `json:"tvaFacturee"`
				TVADed     float64 `json:"tvaDed"`
			} `json:"deductible"`
			Avances []struct {
				IFU       string  `json:"ifu"`
				Nom       string  `json:"nom"`
				TTC       float64 `json:"ttc"`
				HTVA      float64 `json:"htva"`
				CumulHTVA float64 `json:"cumulHTVA"`
			} `json:"avances"`
		} `json:"tva"`
		PREL struct {
			Rows []struct {
				Nom         string  `json:"nom"`
				IFU         string  `json:"ifu"`
				Date        string  `json:"date"`
				MontantHT   float64 `json:"montantHT"`
				Base        float64 `json:"base"`
				Prelevement float64 `json:"prelevement"`
			} `json:"rows"`
		} `json:"prel"`
	} `json:"annexes"`
}

func isNonEmpty(s string) bool { return strings.TrimSpace(s) != "" }
func isIFU(s string) bool      { return ifuRe.MatchString(strings.ToUpper(strings.TrimSpace(s))) }
func isDateDMY(s string) bool  { return dateRe.MatchString(strings.TrimSpace(s)) }

// POST /api/contribuable/validate
func (h *ContribuableValidationHandler) Validate(w http.ResponseWriter, r *http.Request) {
	var req contribuableValidationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}

	errors := make([]fieldError, 0, 32)
	add := func(annexe string, row int, field, message string) {
		errors = append(errors, fieldError{Annexe: annexe, Row: row, Field: field, Message: message})
	}

	for i, row := range req.Annexes.IUTS.Rows {
		if !isNonEmpty(row.Nom) {
			add("iuts", i, "nom", "Nom requis")
		}
		if row.SalaireB <= 0 {
			add("iuts", i, "salaireB", "Salaire brut doit être > 0")
		}
		if row.Charges < 0 || row.Charges > 4 {
			add("iuts", i, "charges", "Charges doit être entre 0 et 4")
		}
	}

	for i, row := range req.Annexes.RSFON.Rows {
		if !isNonEmpty(row.Identite) {
			add("rsfon", i, "identite", "Identité requise")
		}
		if !isIFU(row.IFU) {
			add("rsfon", i, "ifu", "IFU invalide (10 chiffres + 2 lettres)")
		}
		if row.Loyer <= 0 {
			add("rsfon", i, "loyer", "Loyer doit être > 0")
		}
	}

	for i, row := range req.Annexes.RSLIB.Rows {
		if !isIFU(row.IFU) {
			add("rslib", i, "ifu", "IFU invalide (10 chiffres + 2 lettres)")
		}
		if !isNonEmpty(row.Identification) {
			add("rslib", i, "identification", "Identification requise")
		}
		if !isNonEmpty(row.Adresse) {
			add("rslib", i, "adresse", "Adresse requise")
		}
		if !isNonEmpty(row.Nature) {
			add("rslib", i, "nature", "Nature requise")
		}
		if !isDateDMY(row.Date) {
			add("rslib", i, "date", "Date invalide (jj/mm/aaaa)")
		}
		if row.Montant <= 0 {
			add("rslib", i, "montant", "Montant doit être > 0")
		}
	}

	for i, row := range req.Annexes.RSETR.Rows {
		if !isNonEmpty(row.Nom) {
			add("rsetr", i, "nom", "Nom requis")
		}
		if !isNonEmpty(row.Activite) {
			add("rsetr", i, "activite", "Activité requise")
		}
		if !isNonEmpty(row.Adresse) {
			add("rsetr", i, "adresse", "Adresse requise")
		}
		if !isNonEmpty(row.Nature) {
			add("rsetr", i, "nature", "Nature requise")
		}
		if !isDateDMY(row.Date) {
			add("rsetr", i, "date", "Date invalide (jj/mm/aaaa)")
		}
		if row.Montant <= 0 {
			add("rsetr", i, "montant", "Montant doit être > 0")
		}
	}

	for i, row := range req.Annexes.RSPRE.Rows {
		if !isIFU(row.IFU) {
			add("rspre", i, "ifu", "IFU invalide (10 chiffres + 2 lettres)")
		}
		if !isNonEmpty(row.Identification) {
			add("rspre", i, "identification", "Identification requise")
		}
		if !isNonEmpty(row.Adresse) {
			add("rspre", i, "adresse", "Adresse requise")
		}
		if !isNonEmpty(row.Nature) {
			add("rspre", i, "nature", "Nature requise")
		}
		if !isDateDMY(row.Date) {
			add("rspre", i, "date", "Date invalide (jj/mm/aaaa)")
		}
		if row.Montant <= 0 {
			add("rspre", i, "montant", "Montant doit être > 0")
		}
	}

	for i, row := range req.Annexes.RSTVA.Rows {
		if !isIFU(row.IFU) {
			add("rstva", i, "ifu", "IFU invalide (10 chiffres + 2 lettres)")
		}
		if !isNonEmpty(row.Identification) {
			add("rstva", i, "identification", "Identification requise")
		}
		if !isNonEmpty(row.Adresse) {
			add("rstva", i, "adresse", "Adresse requise")
		}
		if !isNonEmpty(row.Nature) {
			add("rstva", i, "nature", "Nature requise")
		}
		if !isDateDMY(row.Date) {
			add("rstva", i, "date", "Date invalide (jj/mm/aaaa)")
		}
		if row.MontantTVA <= 0 {
			add("rstva", i, "montantTVA", "Montant TVA doit être > 0")
		}
	}

	for i, row := range req.Annexes.TVA.Deductible {
		if !isIFU(row.IFU) {
			add("tva.deductible", i, "ifu", "IFU invalide (10 chiffres + 2 lettres)")
		}
		if !isNonEmpty(row.Nom) {
			add("tva.deductible", i, "nom", "Nom requis")
		}
		if !isDateDMY(row.Date) {
			add("tva.deductible", i, "date", "Date invalide (jj/mm/aaaa)")
		}
		if row.HT <= 0 {
			add("tva.deductible", i, "ht", "Montant HT doit être > 0")
		}
		if row.TVADed < 0 {
			add("tva.deductible", i, "tvaDed", "TVA déductible doit être >= 0")
		}
		if row.TVADed > row.TVAFacture {
			add("tva.deductible", i, "tvaDed", "TVA déductible ne peut pas dépasser TVA facturée")
		}
	}

	for i, row := range req.Annexes.TVA.Avances {
		if !isIFU(row.IFU) {
			add("tva.avances", i, "ifu", "IFU invalide (10 chiffres + 2 lettres)")
		}
		if !isNonEmpty(row.Nom) {
			add("tva.avances", i, "nom", "Nom requis")
		}
		if row.TTC <= 0 {
			add("tva.avances", i, "ttc", "Montant TTC doit être > 0")
		}
		if row.CumulHTVA < row.HTVA {
			add("tva.avances", i, "cumulHTVA", "HTVA cumulé ne peut pas être inférieur à HTVA période")
		}
	}

	for i, row := range req.Annexes.PREL.Rows {
		if !isNonEmpty(row.Nom) {
			add("prel", i, "nom", "Nom requis")
		}
		if !isIFU(row.IFU) {
			add("prel", i, "ifu", "IFU invalide (10 chiffres + 2 lettres)")
		}
		if !isDateDMY(row.Date) {
			add("prel", i, "date", "Date invalide (jj/mm/aaaa)")
		}
		if row.MontantHT <= 0 {
			add("prel", i, "montantHT", "Montant HT doit être > 0")
		}
		if row.Base < 0 {
			add("prel", i, "base", "Base imposable doit être >= 0")
		}
		if row.Base > row.MontantHT {
			add("prel", i, "base", "Base imposable ne peut pas dépasser Montant HT")
		}
		if row.Prelevement < 0 {
			add("prel", i, "prelevement", "Prélèvement doit être >= 0")
		}
		if row.Prelevement > row.Base {
			add("prel", i, "prelevement", "Prélèvement ne peut pas dépasser Base imposable")
		}
	}

	resp := validationResponse{
		OK:     len(errors) == 0,
		Errors: errors,
	}
	if !resp.OK {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(w).Encode(resp)
		return
	}
	jsonOK(w, resp)
}
