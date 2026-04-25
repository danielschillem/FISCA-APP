package handlers

import (
	"encoding/csv"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	mw "github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/mailer"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
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
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM companies`).Scan(&s.TotalCompanies)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM companies WHERE is_active = TRUE`).Scan(&s.ActiveCompanies)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role != 'super_admin' AND created_at > NOW() - INTERVAL '30 days'`).Scan(&s.NewUsersLast30d)
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
		log.Printf("[ADMIN MAILER] Erreur reset pour %s: %v", email, err)
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
		query += fmt.Sprintf(" AND (c.nom ILIKE $%d OR u.email ILIKE $%d OR c.ifu ILIKE $%d)", argN, argN+1, argN+2)
		args = append(args, "%"+search+"%", "%"+search+"%", "%"+search+"%")
		argN += 3 //nolint:ineffassign
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

// GET /api/admin/ops-overview
// Dashboard FISCA Gestion: métriques plateforme, transactions OM, traçabilité et croissance.
func (h *AdminHandler) OpsOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	windowDays := 30
	if raw := strings.TrimSpace(r.URL.Query().Get("window_days")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && (v == 7 || v == 30 || v == 90 || v == 180) {
			windowDays = v
		}
	}

	type paymentStat struct {
		DocumentType string  `json:"document_type"`
		Count        int     `json:"count"`
		Total        float64 `json:"total"`
	}
	type monthlyRevenue struct {
		Month string  `json:"month"`
		Count int     `json:"count"`
		Total float64 `json:"total"`
		Frais float64 `json:"frais"`
	}
	type recentPayment struct {
		ID           string    `json:"id"`
		CompanyName  string    `json:"company_name"`
		UserEmail    string    `json:"user_email"`
		DocumentType string    `json:"document_type"`
		Statut       string    `json:"statut"`
		Total        float64   `json:"total"`
		Frais        float64   `json:"frais"`
		Telephone    string    `json:"telephone"`
		CreatedAt    time.Time `json:"created_at"`
	}
	type overview struct {
		PaymentsTotalCount     int              `json:"payments_total_count"`
		PaymentsCompletedCount int              `json:"payments_completed_count"`
		PaymentsPendingCount   int              `json:"payments_pending_count"`
		PaymentsFailedCount    int              `json:"payments_failed_count"`
		PaymentsExpiredCount   int              `json:"payments_expired_count"`
		PaymentsVolume         float64          `json:"payments_volume"`
		FeesCollected          float64          `json:"fees_collected"`
		AvgTicket              float64          `json:"avg_ticket"`
		PaymentsLast30dCount   int              `json:"payments_last30d_count"`
		PaymentsPrev30dCount   int              `json:"payments_prev30d_count"`
		PaymentsGrowthPct      float64          `json:"payments_growth_pct"`
		AuditLast24h           int              `json:"audit_last24h"`
		AuditLast7d            int              `json:"audit_last7d"`
		AuditLast30d           int              `json:"audit_last30d"`
		TopDocumentTypes       []paymentStat    `json:"top_document_types"`
		MonthlyRevenue         []monthlyRevenue `json:"monthly_revenue"`
		RecentPayments         []recentPayment  `json:"recent_payments"`
		RecentAudits           []models.AuditLog `json:"recent_audits"`
	}

	out := overview{
		TopDocumentTypes: []paymentStat{},
		MonthlyRevenue:   []monthlyRevenue{},
		RecentPayments:   []recentPayment{},
		RecentAudits:     []models.AuditLog{},
	}

	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM payments`).Scan(&out.PaymentsTotalCount)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM payments WHERE statut='completed'`).Scan(&out.PaymentsCompletedCount)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM payments WHERE statut='pending'`).Scan(&out.PaymentsPendingCount)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM payments WHERE statut='failed'`).Scan(&out.PaymentsFailedCount)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM payments WHERE statut='expired'`).Scan(&out.PaymentsExpiredCount)
	h.DB.QueryRow(ctx, `SELECT COALESCE(SUM(total),0) FROM payments WHERE statut='completed'`).Scan(&out.PaymentsVolume)
	h.DB.QueryRow(ctx, `SELECT COALESCE(SUM(frais),0) FROM payments WHERE statut='completed'`).Scan(&out.FeesCollected)
	h.DB.QueryRow(ctx, `SELECT COALESCE(AVG(total),0) FROM payments WHERE statut='completed'`).Scan(&out.AvgTicket)

	h.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM payments
		WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
	`, windowDays).Scan(&out.PaymentsLast30dCount)
	h.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM payments
		WHERE created_at >= NOW() - (($1::int * 2) * INTERVAL '1 day')
		  AND created_at < NOW() - ($1::int * INTERVAL '1 day')
	`, windowDays).Scan(&out.PaymentsPrev30dCount)
	if out.PaymentsPrev30dCount > 0 {
		out.PaymentsGrowthPct = (float64(out.PaymentsLast30dCount-out.PaymentsPrev30dCount) / float64(out.PaymentsPrev30dCount)) * 100
	} else if out.PaymentsLast30dCount > 0 {
		out.PaymentsGrowthPct = 100
	}

	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours'`).Scan(&out.AuditLast24h)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM audit_logs WHERE created_at >= NOW() - INTERVAL '7 days'`).Scan(&out.AuditLast7d)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM audit_logs WHERE created_at >= NOW() - INTERVAL '30 days'`).Scan(&out.AuditLast30d)

	topRows, err := h.DB.Query(ctx, `
		SELECT document_type, COUNT(*)::int AS cnt, COALESCE(SUM(total),0) AS total
		FROM payments
		WHERE statut='completed'
		GROUP BY document_type
		ORDER BY cnt DESC
		LIMIT 6`)
	if err == nil {
		defer topRows.Close()
		for topRows.Next() {
			var t paymentStat
			if err := topRows.Scan(&t.DocumentType, &t.Count, &t.Total); err == nil {
				out.TopDocumentTypes = append(out.TopDocumentTypes, t)
			}
		}
	}

	revRows, err := h.DB.Query(ctx, `
		SELECT TO_CHAR(date_trunc('month', created_at), 'YYYY-MM') AS ym,
		       COUNT(*)::int AS cnt,
		       COALESCE(SUM(total),0) AS total,
		       COALESCE(SUM(frais),0) AS frais
		FROM payments
		WHERE statut='completed'
		  AND created_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
		GROUP BY date_trunc('month', created_at)
		ORDER BY date_trunc('month', created_at) ASC`)
	if err == nil {
		defer revRows.Close()
		for revRows.Next() {
			var m monthlyRevenue
			if err := revRows.Scan(&m.Month, &m.Count, &m.Total, &m.Frais); err == nil {
				out.MonthlyRevenue = append(out.MonthlyRevenue, m)
			}
		}
	}

	pRows, err := h.DB.Query(ctx, `
		SELECT p.id, COALESCE(c.nom,'-') AS company_name, COALESCE(u.email,'-') AS user_email,
		       p.document_type, p.statut, p.total, p.frais, p.telephone, p.created_at
		FROM payments p
		LEFT JOIN companies c ON c.id = p.company_id
		LEFT JOIN users u ON u.id = p.user_id
		ORDER BY p.created_at DESC
		LIMIT 20`)
	if err == nil {
		defer pRows.Close()
		for pRows.Next() {
			var p recentPayment
			if err := pRows.Scan(&p.ID, &p.CompanyName, &p.UserEmail, &p.DocumentType, &p.Statut, &p.Total, &p.Frais, &p.Telephone, &p.CreatedAt); err == nil {
				out.RecentPayments = append(out.RecentPayments, p)
			}
		}
	}

	aRows, err := h.DB.Query(ctx, `
		SELECT a.id, a.admin_id, u.email, a.action, a.target_type, a.target_id, a.details, a.created_at
		FROM audit_logs a
		JOIN users u ON u.id = a.admin_id
		ORDER BY a.created_at DESC
		LIMIT 20`)
	if err == nil {
		defer aRows.Close()
		for aRows.Next() {
			var a models.AuditLog
			if err := aRows.Scan(&a.ID, &a.AdminID, &a.AdminEmail, &a.Action, &a.TargetType, &a.TargetID, &a.Details, &a.CreatedAt); err == nil {
				out.RecentAudits = append(out.RecentAudits, a)
			}
		}
	}

	jsonOK(w, out)
}

func parseDateBound(raw string, endOfDay bool) (*time.Time, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	// support YYYY-MM-DD
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		if endOfDay {
			v := time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 0, time.UTC)
			return &v, nil
		}
		v := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
		return &v, nil
	}
	// support RFC3339
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return &t, nil
	}
	return nil, fmt.Errorf("date invalide")
}

// GET /api/admin/transactions
func (h *AdminHandler) ListTransactions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	page, limit := 1, 25
	if v, err := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("page"))); err == nil && v > 0 {
		page = v
	}
	if v, err := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("limit"))); err == nil && v > 0 && v <= 200 {
		limit = v
	}
	offset := (page - 1) * limit

	status := strings.TrimSpace(r.URL.Query().Get("status"))
	docType := strings.TrimSpace(r.URL.Query().Get("document_type"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	from, errFrom := parseDateBound(strings.TrimSpace(r.URL.Query().Get("from")), false)
	to, errTo := parseDateBound(strings.TrimSpace(r.URL.Query().Get("to")), true)
	if errFrom != nil || errTo != nil {
		jsonError(w, "Paramètres de date invalides", http.StatusBadRequest)
		return
	}

	where := []string{"1=1"}
	args := []any{}
	n := 1
	if status != "" && status != "all" {
		where = append(where, fmt.Sprintf("p.statut = $%d", n))
		args = append(args, status)
		n++
	}
	if docType != "" && docType != "all" {
		where = append(where, fmt.Sprintf("p.document_type = $%d", n))
		args = append(args, docType)
		n++
	}
	if search != "" {
		where = append(where, fmt.Sprintf("(c.nom ILIKE $%d OR u.email ILIKE $%d OR p.telephone ILIKE $%d OR COALESCE(p.om_reference,'') ILIKE $%d)", n, n, n, n))
		args = append(args, "%"+search+"%")
		n++
	}
	if from != nil {
		where = append(where, fmt.Sprintf("p.created_at >= $%d", n))
		args = append(args, *from)
		n++
	}
	if to != nil {
		where = append(where, fmt.Sprintf("p.created_at <= $%d", n))
		args = append(args, *to)
		n++
	}
	whereSQL := strings.Join(where, " AND ")

	var total int
	countSQL := `SELECT COUNT(*) FROM payments p LEFT JOIN companies c ON c.id=p.company_id LEFT JOIN users u ON u.id=p.user_id WHERE ` + whereSQL
	h.DB.QueryRow(ctx, countSQL, args...).Scan(&total)

	querySQL := `
		SELECT p.id, COALESCE(c.nom,'-') AS company_name, COALESCE(u.email,'-') AS user_email,
		       p.document_type, p.document_id, p.statut, p.total, p.frais, p.telephone,
		       COALESCE(p.om_reference,''), COALESCE(p.om_order_id,''), p.created_at, p.updated_at
		FROM payments p
		LEFT JOIN companies c ON c.id = p.company_id
		LEFT JOIN users u ON u.id = p.user_id
		WHERE ` + whereSQL + `
		ORDER BY p.created_at DESC
		LIMIT $` + strconv.Itoa(n) + ` OFFSET $` + strconv.Itoa(n+1)
	args = append(args, limit, offset)
	rows, err := h.DB.Query(ctx, querySQL, args...)
	if err != nil {
		jsonError(w, "Erreur base de données", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type item struct {
		ID           string    `json:"id"`
		CompanyName  string    `json:"company_name"`
		UserEmail    string    `json:"user_email"`
		DocumentType string    `json:"document_type"`
		DocumentID   string    `json:"document_id"`
		Statut       string    `json:"statut"`
		Total        float64   `json:"total"`
		Frais        float64   `json:"frais"`
		Telephone    string    `json:"telephone"`
		OMReference  string    `json:"om_reference"`
		OMOrderID    string    `json:"om_order_id"`
		CreatedAt    time.Time `json:"created_at"`
		UpdatedAt    time.Time `json:"updated_at"`
	}
	out := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ID, &it.CompanyName, &it.UserEmail, &it.DocumentType, &it.DocumentID, &it.Statut, &it.Total, &it.Frais, &it.Telephone, &it.OMReference, &it.OMOrderID, &it.CreatedAt, &it.UpdatedAt); err == nil {
			out = append(out, it)
		}
	}
	jsonOK(w, map[string]any{
		"items":  out,
		"page":   page,
		"limit":  limit,
		"total":  total,
		"pages":  (total + limit - 1) / limit,
	})
}

// GET /api/admin/transactions/export
func (h *AdminHandler) ExportTransactionsCSV(w http.ResponseWriter, r *http.Request) {
	// Re-use ListTransactions filters, export full filtered set (limit 5000)
	q := r.URL.Query()
	q.Set("page", "1")
	q.Set("limit", "5000")
	r.URL.RawQuery = q.Encode()

	ctx := r.Context()
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	docType := strings.TrimSpace(r.URL.Query().Get("document_type"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	from, _ := parseDateBound(strings.TrimSpace(r.URL.Query().Get("from")), false)
	to, _ := parseDateBound(strings.TrimSpace(r.URL.Query().Get("to")), true)

	where := []string{"1=1"}
	args := []any{}
	n := 1
	if status != "" && status != "all" {
		where = append(where, fmt.Sprintf("p.statut = $%d", n))
		args = append(args, status)
		n++
	}
	if docType != "" && docType != "all" {
		where = append(where, fmt.Sprintf("p.document_type = $%d", n))
		args = append(args, docType)
		n++
	}
	if search != "" {
		where = append(where, fmt.Sprintf("(c.nom ILIKE $%d OR u.email ILIKE $%d OR p.telephone ILIKE $%d OR COALESCE(p.om_reference,'') ILIKE $%d)", n, n, n, n))
		args = append(args, "%"+search+"%")
		n++
	}
	if from != nil {
		where = append(where, fmt.Sprintf("p.created_at >= $%d", n))
		args = append(args, *from)
		n++
	}
	if to != nil {
		where = append(where, fmt.Sprintf("p.created_at <= $%d", n))
		args = append(args, *to)
		n++
	}
	whereSQL := strings.Join(where, " AND ")

	rows, err := h.DB.Query(ctx, `
		SELECT p.id, COALESCE(c.nom,'-') AS company_name, COALESCE(u.email,'-') AS user_email,
		       p.document_type, p.document_id, p.statut, p.total, p.frais, p.telephone,
		       COALESCE(p.om_reference,''), COALESCE(p.om_order_id,''), p.created_at, p.updated_at
		FROM payments p
		LEFT JOIN companies c ON c.id = p.company_id
		LEFT JOIN users u ON u.id = p.user_id
		WHERE `+whereSQL+`
		ORDER BY p.created_at DESC
		LIMIT 5000`, args...)
	if err != nil {
		jsonError(w, "Erreur export transactions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="admin-transactions.csv"`)
	cw := csv.NewWriter(w)
	cw.Comma = ';'
	_ = cw.Write([]string{"id", "company", "email", "document_type", "document_id", "statut", "total_fcfa", "frais_fcfa", "telephone", "om_reference", "om_order_id", "created_at", "updated_at"})
	for rows.Next() {
		var id, company, email, dType, dID, st, tel, ref, orderID string
		var total, frais float64
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &company, &email, &dType, &dID, &st, &total, &frais, &tel, &ref, &orderID, &createdAt, &updatedAt); err == nil {
			_ = cw.Write([]string{
				id, company, email, dType, dID, st,
				fmt.Sprintf("%.0f", total), fmt.Sprintf("%.0f", frais),
				tel, ref, orderID, createdAt.Format(time.RFC3339), updatedAt.Format(time.RFC3339),
			})
		}
	}
	cw.Flush()
}

// GET /api/admin/finance
func (h *AdminHandler) FinanceOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	windowDays := 180
	if v, err := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("window_days"))); err == nil && (v == 30 || v == 90 || v == 180 || v == 365) {
		windowDays = v
	}

	type monthly struct {
		Month string  `json:"month"`
		Count int     `json:"count"`
		Total float64 `json:"total"`
		Frais float64 `json:"frais"`
	}
	type docStat struct {
		DocumentType string  `json:"document_type"`
		Count        int     `json:"count"`
		Total        float64 `json:"total"`
	}
	out := map[string]any{
		"window_days": windowDays,
		"monthly":     []monthly{},
		"by_document": []docStat{},
	}

	var totalRevenue, totalFees float64
	var txCount int
	h.DB.QueryRow(ctx, `
		SELECT COALESCE(SUM(total),0), COALESCE(SUM(frais),0), COUNT(*)::int
		FROM payments
		WHERE statut='completed'
		  AND created_at >= NOW() - ($1::int * INTERVAL '1 day')`, windowDays).Scan(&totalRevenue, &totalFees, &txCount)
	out["total_revenue"] = totalRevenue
	out["total_fees"] = totalFees
	out["tx_count"] = txCount
	if txCount > 0 {
		out["avg_ticket"] = totalRevenue / float64(txCount)
	} else {
		out["avg_ticket"] = 0.0
	}

	rows, err := h.DB.Query(ctx, `
		SELECT TO_CHAR(date_trunc('month', created_at), 'YYYY-MM') AS ym,
		       COUNT(*)::int AS cnt,
		       COALESCE(SUM(total),0) AS total,
		       COALESCE(SUM(frais),0) AS frais
		FROM payments
		WHERE statut='completed'
		  AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
		GROUP BY date_trunc('month', created_at)
		ORDER BY date_trunc('month', created_at) ASC`, windowDays)
	if err == nil {
		defer rows.Close()
		list := []monthly{}
		for rows.Next() {
			var m monthly
			if err := rows.Scan(&m.Month, &m.Count, &m.Total, &m.Frais); err == nil {
				list = append(list, m)
			}
		}
		out["monthly"] = list
	}

	docRows, err := h.DB.Query(ctx, `
		SELECT document_type, COUNT(*)::int, COALESCE(SUM(total),0)
		FROM payments
		WHERE statut='completed'
		  AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
		GROUP BY document_type
		ORDER BY 2 DESC`, windowDays)
	if err == nil {
		defer docRows.Close()
		list := []docStat{}
		for docRows.Next() {
			var d docStat
			if err := docRows.Scan(&d.DocumentType, &d.Count, &d.Total); err == nil {
				list = append(list, d)
			}
		}
		out["by_document"] = list
	}

	jsonOK(w, out)
}

// GET /api/admin/finance/export
func (h *AdminHandler) ExportFinanceCSV(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	windowDays := 180
	if v, err := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("window_days"))); err == nil && (v == 30 || v == 90 || v == 180 || v == 365) {
		windowDays = v
	}
	rows, err := h.DB.Query(ctx, `
		SELECT TO_CHAR(date_trunc('month', created_at), 'YYYY-MM') AS ym,
		       COUNT(*)::int AS cnt,
		       COALESCE(SUM(total),0) AS total,
		       COALESCE(SUM(frais),0) AS frais
		FROM payments
		WHERE statut='completed'
		  AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
		GROUP BY date_trunc('month', created_at)
		ORDER BY date_trunc('month', created_at) ASC`, windowDays)
	if err != nil {
		jsonError(w, "Erreur export finance", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="admin-finance.csv"`)
	cw := csv.NewWriter(w)
	cw.Comma = ';'
	_ = cw.Write([]string{"month", "transactions", "total_fcfa", "frais_fcfa"})
	for rows.Next() {
		var ym string
		var cnt int
		var total, frais float64
		if err := rows.Scan(&ym, &cnt, &total, &frais); err == nil {
			_ = cw.Write([]string{ym, strconv.Itoa(cnt), fmt.Sprintf("%.0f", total), fmt.Sprintf("%.0f", frais)})
		}
	}
	cw.Flush()
}

// GET /api/admin/observability
func (h *AdminHandler) Observability(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	page, limit := 1, 50
	if v, err := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("page"))); err == nil && v > 0 {
		page = v
	}
	if v, err := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("limit"))); err == nil && v > 0 && v <= 200 {
		limit = v
	}
	offset := (page - 1) * limit

	action := strings.TrimSpace(r.URL.Query().Get("action"))
	targetType := strings.TrimSpace(r.URL.Query().Get("target_type"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	from, errFrom := parseDateBound(strings.TrimSpace(r.URL.Query().Get("from")), false)
	to, errTo := parseDateBound(strings.TrimSpace(r.URL.Query().Get("to")), true)
	if errFrom != nil || errTo != nil {
		jsonError(w, "Paramètres de date invalides", http.StatusBadRequest)
		return
	}

	where := []string{"1=1"}
	args := []any{}
	n := 1
	if action != "" {
		where = append(where, fmt.Sprintf("a.action ILIKE $%d", n))
		args = append(args, "%"+action+"%")
		n++
	}
	if targetType != "" && targetType != "all" {
		where = append(where, fmt.Sprintf("a.target_type = $%d", n))
		args = append(args, targetType)
		n++
	}
	if search != "" {
		where = append(where, fmt.Sprintf("(u.email ILIKE $%d OR COALESCE(a.target_id,'') ILIKE $%d OR a.action ILIKE $%d)", n, n, n))
		args = append(args, "%"+search+"%")
		n++
	}
	if from != nil {
		where = append(where, fmt.Sprintf("a.created_at >= $%d", n))
		args = append(args, *from)
		n++
	}
	if to != nil {
		where = append(where, fmt.Sprintf("a.created_at <= $%d", n))
		args = append(args, *to)
		n++
	}
	whereSQL := strings.Join(where, " AND ")

	var total int
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM audit_logs a JOIN users u ON u.id=a.admin_id WHERE `+whereSQL, args...).Scan(&total)

	query := `
		SELECT a.id, a.admin_id, u.email, a.action, a.target_type, a.target_id, a.details, a.created_at
		FROM audit_logs a
		JOIN users u ON u.id = a.admin_id
		WHERE ` + whereSQL + `
		ORDER BY a.created_at DESC
		LIMIT $` + strconv.Itoa(n) + ` OFFSET $` + strconv.Itoa(n+1)
	args = append(args, limit, offset)
	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		jsonError(w, "Erreur base de données", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	out := []models.AuditLog{}
	for rows.Next() {
		var l models.AuditLog
		if err := rows.Scan(&l.ID, &l.AdminID, &l.AdminEmail, &l.Action, &l.TargetType, &l.TargetID, &l.Details, &l.CreatedAt); err == nil {
			out = append(out, l)
		}
	}
	jsonOK(w, map[string]any{
		"items": out, "page": page, "limit": limit, "total": total, "pages": (total + limit - 1) / limit,
	})
}

// GET /api/admin/observability/export
func (h *AdminHandler) ExportObservabilityCSV(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	action := strings.TrimSpace(r.URL.Query().Get("action"))
	targetType := strings.TrimSpace(r.URL.Query().Get("target_type"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	from, _ := parseDateBound(strings.TrimSpace(r.URL.Query().Get("from")), false)
	to, _ := parseDateBound(strings.TrimSpace(r.URL.Query().Get("to")), true)

	where := []string{"1=1"}
	args := []any{}
	n := 1
	if action != "" {
		where = append(where, fmt.Sprintf("a.action ILIKE $%d", n))
		args = append(args, "%"+action+"%")
		n++
	}
	if targetType != "" && targetType != "all" {
		where = append(where, fmt.Sprintf("a.target_type = $%d", n))
		args = append(args, targetType)
		n++
	}
	if search != "" {
		where = append(where, fmt.Sprintf("(u.email ILIKE $%d OR COALESCE(a.target_id,'') ILIKE $%d OR a.action ILIKE $%d)", n, n, n))
		args = append(args, "%"+search+"%")
		n++
	}
	if from != nil {
		where = append(where, fmt.Sprintf("a.created_at >= $%d", n))
		args = append(args, *from)
		n++
	}
	if to != nil {
		where = append(where, fmt.Sprintf("a.created_at <= $%d", n))
		args = append(args, *to)
		n++
	}
	whereSQL := strings.Join(where, " AND ")
	rows, err := h.DB.Query(ctx, `
		SELECT a.id, u.email, a.action, a.target_type, COALESCE(a.target_id,''), a.created_at
		FROM audit_logs a
		JOIN users u ON u.id = a.admin_id
		WHERE `+whereSQL+`
		ORDER BY a.created_at DESC
		LIMIT 5000`, args...)
	if err != nil {
		jsonError(w, "Erreur export observability", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="admin-observability.csv"`)
	cw := csv.NewWriter(w)
	cw.Comma = ';'
	_ = cw.Write([]string{"id", "admin_email", "action", "target_type", "target_id", "created_at"})
	for rows.Next() {
		var id, email, act, tt, tid string
		var createdAt time.Time
		if err := rows.Scan(&id, &email, &act, &tt, &tid, &createdAt); err == nil {
			_ = cw.Write([]string{id, email, act, tt, tid, createdAt.Format(time.RFC3339)})
		}
	}
	cw.Flush()
}

func (h *AdminHandler) logAudit(ctx context.Context, adminID, action, targetType, targetID string, details map[string]any) {
	raw, _ := json.Marshal(details)
	h.DB.Exec(ctx,
		`INSERT INTO audit_logs (admin_id, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5)`,
		adminID, action, targetType, targetID, raw,
	)
}

// POST /api/admin/users/{id}/impersonate - génère un JWT court (1h) au nom de l'utilisateur
// avec le claim "impersonated_by" pour traçabilité. Lecture seule côté frontend.
func (h *AdminHandler) Impersonate(w http.ResponseWriter, r *http.Request) {
	targetID := chi.URLParam(r, "id")
	adminID := mw.GetUserID(r)
	ctx := r.Context()

	var u models.User
	var orgID *string
	var orgRole *string
	err := h.DB.QueryRow(ctx,
		`SELECT id, email, COALESCE(password_hash,''), plan, role, user_type, org_id, org_role, is_active, created_at
		 FROM users WHERE id=$1 AND role != 'super_admin'`, targetID,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Plan, &u.Role, &u.UserType, &orgID, &orgRole, &u.IsActive, &u.CreatedAt)
	if err != nil {
		jsonError(w, "Utilisateur introuvable", http.StatusNotFound)
		return
	}
	u.OrgID = orgID
	u.OrgRole = orgRole

	secret := []byte(os.Getenv("JWT_SECRET"))
	claims := jwt.MapClaims{
		"sub":             u.ID,
		"role":            u.Role,
		"userType":        u.UserType,
		"impersonated_by": adminID,
		"iat":             time.Now().Unix(),
		"exp":             time.Now().Add(1 * time.Hour).Unix(), // TTL court
	}
	if u.OrgID != nil {
		claims["orgId"] = *u.OrgID
	}
	if u.OrgRole != nil {
		claims["orgRole"] = *u.OrgRole
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
	if err != nil {
		jsonError(w, "Erreur génération token", http.StatusInternalServerError)
		return
	}

	h.logAudit(ctx, adminID, "admin.impersonate", "user", targetID, map[string]any{"target_email": u.Email})
	jsonOK(w, map[string]any{"token": token, "user": u})
}
