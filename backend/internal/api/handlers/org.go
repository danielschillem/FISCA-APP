package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	mw "github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/mailer"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type OrgHandler struct {
	DB *pgxpool.Pool
}

func NewOrgHandler(db *pgxpool.Pool) *OrgHandler {
	return &OrgHandler{DB: db}
}

// GET /api/org/info — informations de l'organisation + stats
func (h *OrgHandler) GetInfo(w http.ResponseWriter, r *http.Request) {
	orgID := mw.GetOrgID(r)
	if orgID == "" {
		jsonError(w, "Accès réservé aux structures (personne morale)", http.StatusForbidden)
		return
	}

	var org models.Organization
	var ownerID *string
	err := h.DB.QueryRow(r.Context(),
		`SELECT id, nom, ifu, rccm, secteur, plan, max_users, max_companies, max_employees, owner_id, is_active, created_at
		 FROM organizations WHERE id=$1`, orgID,
	).Scan(&org.ID, &org.Nom, &org.IFU, &org.RCCM, &org.Secteur, &org.Plan,
		&org.MaxUsers, &org.MaxCompanies, &org.MaxEmployees, &ownerID, &org.IsActive, &org.CreatedAt)
	if err != nil {
		jsonError(w, "Organisation introuvable", http.StatusNotFound)
		return
	}
	org.OwnerID = ownerID

	var stats models.OrgStats
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM users WHERE org_id=$1`, orgID).Scan(&stats.MemberCount)      //nolint:errcheck
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM companies WHERE org_id=$1`, orgID).Scan(&stats.CompanyCount) //nolint:errcheck
	stats.MaxUsers = org.MaxUsers
	stats.MaxCompanies = org.MaxCompanies
	stats.MaxEmployees = org.MaxEmployees

	jsonOK(w, models.OrgInfo{Organization: org, Stats: stats})
}

// GET /api/org/members — liste des membres de l'organisation
func (h *OrgHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	orgID := mw.GetOrgID(r)
	if orgID == "" {
		jsonError(w, "Accès réservé aux structures", http.StatusForbidden)
		return
	}

	rows, err := h.DB.Query(r.Context(),
		`SELECT id, email, COALESCE(org_role,''), is_active, created_at
		 FROM users WHERE org_id=$1 ORDER BY created_at`, orgID,
	)
	if err != nil {
		jsonError(w, "Erreur serveur", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	members := []models.OrgMember{}
	for rows.Next() {
		var m models.OrgMember
		rows.Scan(&m.ID, &m.Email, &m.OrgRole, &m.IsActive, &m.CreatedAt) //nolint:errcheck
		members = append(members, m)
	}
	jsonOK(w, members)
}

// POST /api/org/members — inviter / créer un utilisateur dans l'organisation
func (h *OrgHandler) InviteMember(w http.ResponseWriter, r *http.Request) {
	orgID := mw.GetOrgID(r)
	if orgID == "" {
		jsonError(w, "Accès réservé aux structures", http.StatusForbidden)
		return
	}

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		OrgRole  string `json:"org_role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		jsonError(w, "Email invalide", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 8 {
		jsonError(w, "Mot de passe : 8 caractères minimum", http.StatusBadRequest)
		return
	}
	validRoles := map[string]bool{
		"org_admin": true, "comptable": true, "gestionnaire_rh": true, "auditeur": true,
	}
	if !validRoles[req.OrgRole] {
		jsonError(w, "Rôle invalide : org_admin | comptable | gestionnaire_rh | auditeur", http.StatusBadRequest)
		return
	}

	// Vérifier la limite d'utilisateurs
	var maxUsers, currentCount int
	h.DB.QueryRow(r.Context(), `SELECT max_users FROM organizations WHERE id=$1`, orgID).Scan(&maxUsers) //nolint:errcheck
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM users WHERE org_id=$1`, orgID).Scan(&currentCount)  //nolint:errcheck
	if maxUsers > 0 && currentCount >= maxUsers {
		jsonError(w, "Limite d'utilisateurs atteinte pour votre plan", http.StatusForbidden)
		return
	}

	// Récupérer le plan de l'org
	var orgPlan string
	h.DB.QueryRow(r.Context(), `SELECT plan FROM organizations WHERE id=$1`, orgID).Scan(&orgPlan) //nolint:errcheck

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "Erreur interne", http.StatusInternalServerError)
		return
	}

	var member models.OrgMember
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO users (email, password_hash, plan, role, user_type, org_id, org_role, is_active)
		 VALUES ($1, $2, $3, 'user', 'morale', $4, $5, TRUE)
		 RETURNING id, email, COALESCE(org_role,''), is_active, created_at`,
		req.Email, string(hash), orgPlan, orgID, req.OrgRole,
	).Scan(&member.ID, &member.Email, &member.OrgRole, &member.IsActive, &member.CreatedAt)
	if err != nil {
		jsonError(w, "Email déjà utilisé", http.StatusConflict)
		return
	}

	// Envoyer l'email d'invitation (asynchrone — ne bloque pas la réponse)
	inviterEmail := mw.GetUserID(r) // on récupère l'email de l'invitant
	var orgNom, inviterEmailStr string
	h.DB.QueryRow(r.Context(), `SELECT nom FROM organizations WHERE id=$1`, orgID).Scan(&orgNom)              //nolint:errcheck
	h.DB.QueryRow(r.Context(), `SELECT email FROM users WHERE id=$1`, mw.GetUserID(r)).Scan(&inviterEmailStr) //nolint:errcheck
	_ = inviterEmail
	go func() {
		_ = mailer.SendInvitation(req.Email, orgNom, inviterEmailStr, req.Password, req.OrgRole)
	}()

	jsonCreated(w, member)
}

// PATCH /api/org/members/{id}/role — changer le rôle d'un membre
func (h *OrgHandler) SetMemberRole(w http.ResponseWriter, r *http.Request) {
	orgID := mw.GetOrgID(r)
	targetID := chi.URLParam(r, "id")

	var req struct {
		OrgRole string `json:"org_role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}
	validRoles := map[string]bool{
		"org_admin": true, "comptable": true, "gestionnaire_rh": true, "auditeur": true,
	}
	if !validRoles[req.OrgRole] {
		jsonError(w, "Rôle invalide", http.StatusBadRequest)
		return
	}

	result, err := h.DB.Exec(r.Context(),
		`UPDATE users SET org_role=$1 WHERE id=$2 AND org_id=$3`,
		req.OrgRole, targetID, orgID,
	)
	if err != nil || result.RowsAffected() == 0 {
		jsonError(w, "Membre introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/org/members/{id} — retirer un membre de l'organisation
func (h *OrgHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	orgID := mw.GetOrgID(r)
	targetID := chi.URLParam(r, "id")
	currentUserID := mw.GetUserID(r)

	if targetID == currentUserID {
		jsonError(w, "Vous ne pouvez pas vous retirer vous-même", http.StatusBadRequest)
		return
	}

	result, err := h.DB.Exec(r.Context(),
		`DELETE FROM users WHERE id=$1 AND org_id=$2`,
		targetID, orgID,
	)
	if err != nil || result.RowsAffected() == 0 {
		jsonError(w, "Membre introuvable", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/org/companies — sociétés de l'org avec leurs membres ayant accès
func (h *OrgHandler) ListCompanies(w http.ResponseWriter, r *http.Request) {
	orgID := mw.GetOrgID(r)
	if orgID == "" {
		jsonError(w, "Accès réservé aux structures", http.StatusForbidden)
		return
	}

	rows, err := h.DB.Query(r.Context(),
		`SELECT c.id, c.nom, COALESCE(c.ifu,''), COALESCE(c.secteur,''), c.is_active,
		        COALESCE(
		            json_agg(
		                json_build_object('user_id', u.id, 'email', u.email, 'org_role', COALESCE(u.org_role,''))
		            ) FILTER (WHERE u.id IS NOT NULL), '[]'
		        ) AS members
		 FROM companies c
		 LEFT JOIN org_company_access oca ON oca.company_id = c.id
		 LEFT JOIN users u ON u.id = oca.user_id
		 WHERE c.org_id = $1
		 GROUP BY c.id ORDER BY c.nom`, orgID,
	)
	if err != nil {
		jsonError(w, "Erreur serveur", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type orgCompany struct {
		ID       string          `json:"id"`
		Nom      string          `json:"nom"`
		IFU      string          `json:"ifu"`
		Secteur  string          `json:"secteur"`
		IsActive bool            `json:"is_active"`
		Members  json.RawMessage `json:"members"`
	}

	companies := []orgCompany{}
	for rows.Next() {
		var c orgCompany
		rows.Scan(&c.ID, &c.Nom, &c.IFU, &c.Secteur, &c.IsActive, &c.Members) //nolint:errcheck
		companies = append(companies, c)
	}
	jsonOK(w, companies)
}

// POST /api/org/companies/{id}/access — accorder l'accès à une société
func (h *OrgHandler) GrantAccess(w http.ResponseWriter, r *http.Request) {
	orgID := mw.GetOrgID(r)
	companyID := chi.URLParam(r, "id")
	currentUserID := mw.GetUserID(r)

	var req struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		jsonError(w, "user_id requis", http.StatusBadRequest)
		return
	}

	// Vérifier que la société appartient à l'org
	var exists bool
	h.DB.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM companies WHERE id=$1 AND org_id=$2)`,
		companyID, orgID).Scan(&exists) //nolint:errcheck
	if !exists {
		jsonError(w, "Société introuvable dans cette organisation", http.StatusNotFound)
		return
	}

	// Vérifier que l'utilisateur appartient à l'org
	h.DB.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM users WHERE id=$1 AND org_id=$2)`,
		req.UserID, orgID).Scan(&exists) //nolint:errcheck
	if !exists {
		jsonError(w, "Utilisateur introuvable dans cette organisation", http.StatusNotFound)
		return
	}

	h.DB.Exec(r.Context(),
		`INSERT INTO org_company_access (user_id, company_id, granted_by) VALUES ($1,$2,$3)
		 ON CONFLICT DO NOTHING`,
		req.UserID, companyID, currentUserID,
	) //nolint:errcheck

	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/org/companies/{id}/access/{uid} — révoquer l'accès
func (h *OrgHandler) RevokeAccess(w http.ResponseWriter, r *http.Request) {
	orgID := mw.GetOrgID(r)
	companyID := chi.URLParam(r, "id")
	targetUserID := chi.URLParam(r, "uid")

	// Vérifier que la société appartient à l'org
	var exists bool
	h.DB.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM companies WHERE id=$1 AND org_id=$2)`,
		companyID, orgID).Scan(&exists) //nolint:errcheck
	if !exists {
		jsonError(w, "Société introuvable dans cette organisation", http.StatusNotFound)
		return
	}

	h.DB.Exec(r.Context(),
		`DELETE FROM org_company_access WHERE user_id=$1 AND company_id=$2`,
		targetUserID, companyID,
	) //nolint:errcheck

	w.WriteHeader(http.StatusNoContent)
}
