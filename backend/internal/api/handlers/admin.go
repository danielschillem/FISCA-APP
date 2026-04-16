package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	mw "github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/mailer"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AdminHandler struct {
	DB *pgxpool.Pool
}

func NewAdminHandler(db *pgxpool.Pool) *AdminHandler {
	return &AdminHandler{DB: db}
}

// GET /api/admin/stats
func (h *AdminHandler) Stats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var s models.AdminStats
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role != 'super_admin'`).Scan(&s.TotalUsers)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role != 'super_admin' AND is_active = TRUE`).Scan(&s.ActiveUsers)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role != 'super_admin' AND is_active = FALSE`).Scan(&s.SuspendedUsers)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE plan='starter' AND role != 'super_admin'`).Scan(&s.PlanStarter)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE plan='pro' AND role != 'super_admin'`).Scan(&s.PlanPro)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE plan='enterprise' AND role != 'super_admin'`).Scan(&s.PlanEnterprise)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM licenses WHERE status = 'trial'`).Scan(&s.TrialUsers)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM companies`).Scan(&s.TotalCompanies)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM companies WHERE is_active = TRUE`).Scan(&s.ActiveCompanies)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role != 'super_admin' AND created_at > NOW() - INTERVAL '30 days'`).Scan(&s.NewUsersLast30d)
	s.EstimatedMRR = float64(s.PlanPro)*15_000 + float64(s.PlanEnterprise)*50_000
	jsonOK(w, s)
}

// GET /api/admin/users?search=&plan=&status=
func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	plan := r.URL.Query().Get("plan")
	status := r.URL.Query().Get("status")
	query := `
SELECT u.id, u.email, u.plan, u.role, u.is_active, u.created_at,
       COUNT(c.id)::int AS company_count
FROM users u
LEFT JOIN companies c ON c.user_id = u.id
WHERE u.role != 'super_admin'`
	args := []any{}
	argN := 1
	if search != "" {
		query += fmt.Sprintf(" AND u.email ILIKE $%d", argN)
		args = append(args, "%"+search+"%")
		argN++
	}
	if plan != "" {
		query += fmt.Sprintf(" AND u.plan = $%d", argN)
		args = append(args, plan)
		argN++ //nolint:ineffassign
	}
	if status == "active" {
		query += " AND u.is_active = TRUE"
	} else if status == "suspended" {
		query += " AND u.is_active = FALSE"
	}
	query += " GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200"
	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		jsonError(w, "Erreur base de donnees", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	users := []models.AdminUser{}
	for rows.Next() {
		var u models.AdminUser
		if err := rows.Scan(&u.ID, &u.Email, &u.Plan, &u.Role, &u.IsActive, &u.CreatedAt, &u.CompanyCount); err != nil {
			continue
		}
		users = append(users, u)
	}
	jsonOK(w, users)
}

// GET /api/admin/users/{id}
func (h *AdminHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	ctx := r.Context()
	var u models.AdminUser
	err := h.DB.QueryRow(ctx, `
SELECT u.id, u.email, u.plan, u.role, u.is_active, u.created_at,
       COUNT(c.id)::int AS company_count
FROM users u
LEFT JOIN companies c ON c.user_id = u.id
WHERE u.id = $1
GROUP BY u.id`, userID,
	).Scan(&u.ID, &u.Email, &u.Plan, &u.Role, &u.IsActive, &u.CreatedAt, &u.CompanyCount)
	if err != nil {
		jsonError(w, "Utilisateur introuvable", http.StatusNotFound)
		return
	}
	var lic models.License
	err = h.DB.QueryRow(ctx, `
SELECT id, user_id, plan, status, trial_ends_at, expires_at,
       max_companies, max_employees, notes, created_by, created_at, updated_at
FROM licenses WHERE user_id = $1`, userID,
	).Scan(&lic.ID, &lic.UserID, &lic.Plan, &lic.Status, &lic.TrialEndsAt, &lic.ExpiresAt,
		&lic.MaxCompanies, &lic.MaxEmployees, &lic.Notes, &lic.CreatedBy, &lic.CreatedAt, &lic.UpdatedAt)
	if err == nil {
		u.License = &lic
	}
	jsonOK(w, u)
}

// PATCH /api/admin/users/{id}/status
func (h *AdminHandler) SetUserStatus(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	adminID := mw.GetUserID(r)
	var req struct {
		IsActive bool   `json:"is_active"`
		Reason   string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Donnees invalides", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	tag, err := h.DB.Exec(ctx,
		`UPDATE users SET is_active=$1 WHERE id=$2 AND role != 'super_admin'`,
		req.IsActive, userID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Utilisateur introuvable ou non modifiable", http.StatusNotFound)
		return
	}
	action := "user.suspend"
	if req.IsActive {
		action = "user.activate"
	}
	h.logAudit(ctx, adminID, action, "user", userID, map[string]any{"reason": req.Reason})
	jsonOK(w, map[string]any{"ok": true, "is_active": req.IsActive})
}

// PATCH /api/admin/users/{id}/plan
func (h *AdminHandler) SetUserPlan(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	adminID := mw.GetUserID(r)
	var req struct {
		Plan string `json:"plan"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Donnees invalides", http.StatusBadRequest)
		return
	}
	allowed := map[string]bool{"starter": true, "pro": true, "enterprise": true, "custom": true}
	if !allowed[req.Plan] {
		jsonError(w, "Plan invalide (starter|pro|enterprise|custom)", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	tag, err := h.DB.Exec(ctx,
		`UPDATE users SET plan=$1 WHERE id=$2 AND role != 'super_admin'`, req.Plan, userID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "Utilisateur introuvable", http.StatusNotFound)
		return
	}
	h.logAudit(ctx, adminID, "user.plan_change", "user", userID, map[string]any{"new_plan": req.Plan})
	jsonOK(w, map[string]any{"ok": true, "plan": req.Plan})
}

// POST /api/admin/users/{id}/reset-password
func (h *AdminHandler) ResetUserPassword(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	adminID := mw.GetUserID(r)
	ctx := r.Context()
	var email string
	if err := h.DB.QueryRow(ctx, `SELECT email FROM users WHERE id=$1`, userID).Scan(&email); err != nil {
		jsonError(w, "Utilisateur introuvable", http.StatusNotFound)
		return
	}
	h.DB.Exec(ctx, `UPDATE password_reset_tokens SET used=TRUE WHERE user_id=$1`, userID)
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		jsonError(w, "Erreur generation token", http.StatusInternalServerError)
		return
	}
	token := hex.EncodeToString(b)
	expires := time.Now().Add(1 * time.Hour)
	h.DB.Exec(ctx, `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)`,
		userID, token, expires)
	if err := mailer.SendResetPassword(email, token); err != nil {
		fmt.Printf("[ADMIN MAILER] Erreur reset pour %s: %v\n", email, err)
	}
	h.logAudit(ctx, adminID, "user.reset_password", "user", userID, map[string]any{"email": email})
	jsonOK(w, map[string]any{"ok": true, "message": "Lien envoye a " + email})
}

// PUT /api/admin/users/{id}/license
func (h *AdminHandler) UpsertLicense(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	adminID := mw.GetUserID(r)
	var req struct {
		Plan         string     `json:"plan"`
		Status       string     `json:"status"`
		TrialEndsAt  *time.Time `json:"trial_ends_at"`
		ExpiresAt    *time.Time `json:"expires_at"`
		MaxCompanies int        `json:"max_companies"`
		MaxEmployees int        `json:"max_employees"`
		Notes        string     `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Donnees invalides", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	var lic models.License
	err := h.DB.QueryRow(ctx, `
INSERT INTO licenses (user_id, plan, status, trial_ends_at, expires_at,
                      max_companies, max_employees, notes, created_by, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
ON CONFLICT (user_id) DO UPDATE SET
    plan=$2, status=$3, trial_ends_at=$4, expires_at=$5,
    max_companies=$6, max_employees=$7, notes=$8, updated_at=NOW()
RETURNING id, user_id, plan, status, trial_ends_at, expires_at,
          max_companies, max_employees, notes, created_by, created_at, updated_at`,
		userID, req.Plan, req.Status, req.TrialEndsAt, req.ExpiresAt,
		req.MaxCompanies, req.MaxEmployees, req.Notes, adminID,
	).Scan(&lic.ID, &lic.UserID, &lic.Plan, &lic.Status, &lic.TrialEndsAt, &lic.ExpiresAt,
		&lic.MaxCompanies, &lic.MaxEmployees, &lic.Notes, &lic.CreatedBy, &lic.CreatedAt, &lic.UpdatedAt)
	if err != nil {
		jsonError(w, "Erreur sauvegarde licence", http.StatusInternalServerError)
		return
	}
	if req.Plan != "" {
		h.DB.Exec(ctx, `UPDATE users SET plan=$1 WHERE id=$2`, req.Plan, userID)
	}
	h.logAudit(ctx, adminID, "license.upsert", "user", userID, map[string]any{"plan": req.Plan, "status": req.Status})
	jsonOK(w, lic)
}

// GET /api/admin/companies?search=&status=
func (h *AdminHandler) ListCompanies(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	status := r.URL.Query().Get("status")
	query := `
SELECT c.id, c.user_id, u.email, c.nom,
       COALESCE(c.ifu,''), COALESCE(c.secteur,''), c.is_active
FROM companies c
JOIN users u ON u.id = c.user_id
WHERE 1=1`
	args := []any{}
	argN := 1
	if search != "" {
		query += fmt.Sprintf(" AND (c.nom ILIKE $%d OR u.email ILIKE $%d OR c.ifu ILIKE $%d)", argN, argN, argN)
		args = append(args, "%"+search+"%")
		argN++ //nolint:ineffassign
	}
	if status == "active" {
		query += " AND c.is_active = TRUE"
	} else if status == "suspended" {
		query += " AND c.is_active = FALSE"
	}
	query += " ORDER BY c.nom ASC LIMIT 200"
	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		jsonError(w, "Erreur base de donnees", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	companies := []models.AdminCompany{}
	for rows.Next() {
		var c models.AdminCompany
		if err := rows.Scan(&c.ID, &c.UserID, &c.UserEmail, &c.Nom, &c.IFU, &c.Secteur, &c.IsActive); err != nil {
			continue
		}
		companies = append(companies, c)
	}
	jsonOK(w, companies)
}

// PATCH /api/admin/companies/{id}/status
func (h *AdminHandler) SetCompanyStatus(w http.ResponseWriter, r *http.Request) {
	companyID := chi.URLParam(r, "id")
	adminID := mw.GetUserID(r)
	var req struct {
		IsActive bool   `json:"is_active"`
		Reason   string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Donnees invalides", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	_, err := h.DB.Exec(ctx, `UPDATE companies SET is_active=$1 WHERE id=$2`, req.IsActive, companyID)
	if err != nil {
		jsonError(w, "Erreur mise a jour", http.StatusInternalServerError)
		return
	}
	action := "company.suspend"
	if req.IsActive {
		action = "company.activate"
	}
	h.logAudit(ctx, adminID, action, "company", companyID, map[string]any{"reason": req.Reason})
	jsonOK(w, map[string]any{"ok": true, "is_active": req.IsActive})
}

// GET /api/admin/audit?limit=50&offset=0
func (h *AdminHandler) ListAudit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	limit := 50
	offset := 0
	fmt.Sscanf(r.URL.Query().Get("limit"), "%d", &limit)
	fmt.Sscanf(r.URL.Query().Get("offset"), "%d", &offset)
	if limit > 200 {
		limit = 200
	}
	rows, err := h.DB.Query(ctx, `
SELECT a.id, a.admin_id, u.email, a.action, a.target_type,
       a.target_id, a.details, a.created_at
FROM audit_logs a
JOIN users u ON u.id = a.admin_id
ORDER BY a.created_at DESC
LIMIT $1 OFFSET $2`, limit, offset,
	)
	if err != nil {
		jsonError(w, "Erreur base de donnees", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	logs := []models.AuditLog{}
	for rows.Next() {
		var l models.AuditLog
		if err := rows.Scan(&l.ID, &l.AdminID, &l.AdminEmail, &l.Action,
			&l.TargetType, &l.TargetID, &l.Details, &l.CreatedAt); err != nil {
			continue
		}
		logs = append(logs, l)
	}
	jsonOK(w, logs)
}

func (h *AdminHandler) logAudit(ctx context.Context, adminID, action, targetType, targetID string, details map[string]any) {
	raw, _ := json.Marshal(details)
	h.DB.Exec(ctx,
		`INSERT INTO audit_logs (admin_id, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5)`,
		adminID, action, targetType, targetID, raw,
	)
}
