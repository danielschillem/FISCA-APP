package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CompanyHandler struct {
	DB *pgxpool.Pool
}

func NewCompanyHandler(db *pgxpool.Pool) *CompanyHandler {
	return &CompanyHandler{DB: db}
}

// GET /api/company
func (h *CompanyHandler) Get(w http.ResponseWriter, r *http.Request) {
	companyID := middleware.GetCompanyID(r)
	if companyID == "" {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	var c models.Company
	err := h.DB.QueryRow(r.Context(),
		`SELECT id, user_id, nom,
		        COALESCE(ifu,''), COALESCE(rc,''), COALESCE(secteur,''),
		        COALESCE(adresse,''), COALESCE(tel,''),
		        COALESCE(forme_juridique,''), COALESCE(regime,''),
		        COALESCE(centre_impots,''), COALESCE(code_activite,''),
		        COALESCE(TO_CHAR(date_debut_activite,'YYYY-MM-DD'),''),
		        COALESCE(email_entreprise,''), COALESCE(ville,''),
		        COALESCE(quartier,''), COALESCE(bp,''), COALESCE(fax,'')
		 FROM companies WHERE id=$1 LIMIT 1`, companyID,
	).Scan(&c.ID, &c.UserID, &c.Nom, &c.IFU, &c.RC, &c.Secteur, &c.Adresse, &c.Tel,
		&c.FormeJuridique, &c.Regime, &c.CentreImpots, &c.CodeActivite,
		&c.DateDebutActivite, &c.EmailEntreprise, &c.Ville, &c.Quartier, &c.BP, &c.Fax)
	if err != nil {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	jsonOK(w, c)
}

// PUT /api/company
func (h *CompanyHandler) Update(w http.ResponseWriter, r *http.Request) {
	companyID := middleware.GetCompanyID(r)
	if companyID == "" {
		jsonError(w, "Entreprise introuvable", http.StatusNotFound)
		return
	}
	var c models.Company
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	c.IFU = strings.TrimSpace(c.IFU)
	if err := ensureIFUAvailable(h.DB, companyID, c.IFU); err != nil {
		if err.Error() == "ifu_already_used" {
			jsonError(w, "IFU déjà utilisé par une autre société", http.StatusConflict)
			return
		}
		jsonError(w, "Erreur de contrôle IFU", http.StatusInternalServerError)
		return
	}

	// Normalise la date : chaîne vide → NULL
	var dateDebut interface{}
	if c.DateDebutActivite != "" {
		dateDebut = c.DateDebutActivite
	}

	tag, err := h.DB.Exec(r.Context(),
		`UPDATE companies SET
		    nom=$1, ifu=$2, rc=$3, secteur=$4, adresse=$5, tel=$6,
		    forme_juridique=$7, regime=$8, centre_impots=$9, code_activite=$10,
		    date_debut_activite=$11, email_entreprise=$12,
		    ville=$13, quartier=$14, bp=$15, fax=$16
		 WHERE id=$17`,
		c.Nom, c.IFU, c.RC, c.Secteur, c.Adresse, c.Tel,
		c.FormeJuridique, c.Regime, c.CentreImpots, c.CodeActivite,
		dateDebut, c.EmailEntreprise,
		c.Ville, c.Quartier, c.BP, c.Fax,
		companyID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Erreur mise à jour", http.StatusInternalServerError)
		return
	}
	jsonOK(w, c)
}
