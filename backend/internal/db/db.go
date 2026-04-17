package db

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// Connect initialise le pool de connexions PostgreSQL.
func Connect() (*pgxpool.Pool, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL non défini")
	}

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parsing config DB: %w", err)
	}

	// Timeout par connexion (critique pour Neon free tier qui peut dormir)
	config.ConnConfig.ConnectTimeout = 15 * time.Second

	// Pool tuning — réduit pour Neon free tier (max 20 connexions au total)
	config.MaxConns = 5
	config.MinConns = 1
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute
	config.HealthCheckPeriod = 1 * time.Minute

	// Timeout de 15s pour le ping initial
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("connexion DB: %w", err)
	}

	pingCtx, pingCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer pingCancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping DB: %w", err)
	}
	return pool, nil
}

// RunMigrations crée les tables si elles n'existent pas.
func RunMigrations(pool *pgxpool.Pool) error {
	schema := `
	CREATE EXTENSION IF NOT EXISTS "pgcrypto";

	CREATE TABLE IF NOT EXISTS users (
		id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		email         TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		plan          TEXT NOT NULL DEFAULT 'starter',
		created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS companies (
		id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		nom      TEXT NOT NULL,
		ifu      TEXT,
		rc       TEXT,
		secteur  TEXT,
		adresse  TEXT,
		tel      TEXT
	);

	CREATE TABLE IF NOT EXISTS employees (
		id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		nom          TEXT NOT NULL,
		categorie    TEXT NOT NULL DEFAULT 'Non-cadre',
		charges      INT NOT NULL DEFAULT 0,
		salaire_base NUMERIC(12,2) NOT NULL DEFAULT 0,
		anciennete   NUMERIC(12,2) NOT NULL DEFAULT 0,
		heures_sup   NUMERIC(12,2) NOT NULL DEFAULT 0,
		logement     NUMERIC(12,2) NOT NULL DEFAULT 0,
		transport    NUMERIC(12,2) NOT NULL DEFAULT 0,
		fonction     NUMERIC(12,2) NOT NULL DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS declarations (
		id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		periode     TEXT NOT NULL,
		mois        INT NOT NULL,
		annee       INT NOT NULL,
		nb_salaries INT NOT NULL DEFAULT 0,
		brut_total  NUMERIC(14,2) NOT NULL DEFAULT 0,
		iuts_total  NUMERIC(14,2) NOT NULL DEFAULT 0,
		tpa_total   NUMERIC(14,2) NOT NULL DEFAULT 0,
		css_total   NUMERIC(14,2) NOT NULL DEFAULT 0,
		total       NUMERIC(14,2) NOT NULL DEFAULT 0,
		statut      TEXT NOT NULL DEFAULT 'en_cours',
		ref         TEXT,
		date_depot  TIMESTAMPTZ,
		created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS bulletins (
		id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
		mois         INT NOT NULL,
		annee        INT NOT NULL,
		periode      TEXT NOT NULL,
		nom_employe  TEXT NOT NULL,
		categorie    TEXT NOT NULL,
		salaire_base NUMERIC(12,2) NOT NULL DEFAULT 0,
		anciennete   NUMERIC(12,2) NOT NULL DEFAULT 0,
		heures_sup   NUMERIC(12,2) NOT NULL DEFAULT 0,
		logement     NUMERIC(12,2) NOT NULL DEFAULT 0,
		transport    NUMERIC(12,2) NOT NULL DEFAULT 0,
		fonction     NUMERIC(12,2) NOT NULL DEFAULT 0,
		charges      INT NOT NULL DEFAULT 0,
		cotisation   TEXT NOT NULL DEFAULT 'CNSS',
		brut_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
		base_imp     NUMERIC(12,2) NOT NULL DEFAULT 0,
		iuts_brut    NUMERIC(12,2) NOT NULL DEFAULT 0,
		iuts_net     NUMERIC(12,2) NOT NULL DEFAULT 0,
		cot_soc      NUMERIC(12,2) NOT NULL DEFAULT 0,
		tpa          NUMERIC(12,2) NOT NULL DEFAULT 0,
		fsp          NUMERIC(12,2) NOT NULL DEFAULT 0,
		salaire_net  NUMERIC(12,2) NOT NULL DEFAULT 0,
		created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		UNIQUE (company_id, employee_id, mois, annee)
	);

	CREATE TABLE IF NOT EXISTS simulations (
		id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		label       TEXT NOT NULL DEFAULT '',
		cotisation  TEXT NOT NULL DEFAULT 'CNSS',
		input_data  JSONB NOT NULL,
		result_data JSONB NOT NULL,
		created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS tva_declarations (
		id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		periode        TEXT NOT NULL,
		mois           INT NOT NULL,
		annee          INT NOT NULL,
		ca_ttc         NUMERIC(14,2) NOT NULL DEFAULT 0,
		ca_ht          NUMERIC(14,2) NOT NULL DEFAULT 0,
		tva_collectee  NUMERIC(14,2) NOT NULL DEFAULT 0,
		tva_deductible NUMERIC(14,2) NOT NULL DEFAULT 0,
		tva_nette      NUMERIC(14,2) NOT NULL DEFAULT 0,
		statut         TEXT NOT NULL DEFAULT 'brouillon',
		ref            TEXT,
		created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS tva_lignes (
		id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		declaration_id UUID NOT NULL REFERENCES tva_declarations(id) ON DELETE CASCADE,
		type_op        TEXT NOT NULL,
		description    TEXT NOT NULL,
		montant_ht     NUMERIC(14,2) NOT NULL DEFAULT 0,
		taux_tva       NUMERIC(5,2)  NOT NULL DEFAULT 18.00,
		montant_tva    NUMERIC(14,2) NOT NULL DEFAULT 0,
		montant_ttc    NUMERIC(14,2) NOT NULL DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS workflow_etapes (
		id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		declaration_id UUID NOT NULL REFERENCES declarations(id) ON DELETE CASCADE,
		etape          TEXT NOT NULL,
		commentaire    TEXT NOT NULL DEFAULT '',
		user_id        UUID NOT NULL REFERENCES users(id),
		created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS password_reset_tokens (
		id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		token      TEXT NOT NULL UNIQUE,
		expires_at TIMESTAMPTZ NOT NULL,
		used       BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	-- Ajout colonne cotisation sur employees (idempotent)
	ALTER TABLE employees ADD COLUMN IF NOT EXISTS cotisation TEXT NOT NULL DEFAULT 'CNSS';

	CREATE TABLE IF NOT EXISTS refresh_tokens (
		id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		token      TEXT NOT NULL UNIQUE,
		expires_at TIMESTAMPTZ NOT NULL,
		revoked    BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS retenues_source (
		id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		periode         TEXT NOT NULL,
		mois            INT  NOT NULL,
		annee           INT  NOT NULL,
		beneficiaire    TEXT NOT NULL,
		type_retenue    TEXT NOT NULL DEFAULT 'services',
		montant_brut    NUMERIC(14,2) NOT NULL DEFAULT 0,
		taux_retenue    NUMERIC(5,2)  NOT NULL DEFAULT 20,
		montant_retenue NUMERIC(14,2) NOT NULL DEFAULT 0,
		montant_net     NUMERIC(14,2) NOT NULL DEFAULT 0,
		statut          TEXT NOT NULL DEFAULT 'en_cours',
		ref             TEXT,
		created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS cnss_patronal (
		id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		periode                 TEXT NOT NULL,
		mois                    INT  NOT NULL,
		annee                   INT  NOT NULL,
		nb_salaries_cnss        INT  NOT NULL DEFAULT 0,
		nb_salaries_carfo       INT  NOT NULL DEFAULT 0,
		base_cnss               NUMERIC(14,2) NOT NULL DEFAULT 0,
		base_carfo              NUMERIC(14,2) NOT NULL DEFAULT 0,
		cotisation_pat_cnss     NUMERIC(14,2) NOT NULL DEFAULT 0,
		cotisation_sal_cnss     NUMERIC(14,2) NOT NULL DEFAULT 0,
		cotisation_pat_carfo    NUMERIC(14,2) NOT NULL DEFAULT 0,
		cotisation_sal_carfo    NUMERIC(14,2) NOT NULL DEFAULT 0,
		total_cnss              NUMERIC(14,2) NOT NULL DEFAULT 0,
		total_carfo             NUMERIC(14,2) NOT NULL DEFAULT 0,
		total_general           NUMERIC(14,2) NOT NULL DEFAULT 0,
		statut                  TEXT NOT NULL DEFAULT 'brouillon',
		created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		UNIQUE (company_id, mois, annee)
	);

	-- Index sur les colonnes fréquemment utilisées en WHERE
	CREATE INDEX IF NOT EXISTS idx_employees_company_id    ON employees(company_id);
	CREATE INDEX IF NOT EXISTS idx_declarations_company_id ON declarations(company_id);
	CREATE INDEX IF NOT EXISTS idx_declarations_period     ON declarations(company_id, annee DESC, mois DESC);
	CREATE TABLE IF NOT EXISTS exercices_fiscaux (
		id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		annee        INT  NOT NULL,
		date_debut   DATE NOT NULL,
		date_fin     DATE NOT NULL,
		statut       TEXT NOT NULL DEFAULT 'en_cours', -- 'en_cours' | 'cloture'
		date_cloture TIMESTAMPTZ,
		note         TEXT NOT NULL DEFAULT '',
		created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		UNIQUE (company_id, annee)
	);

	CREATE INDEX IF NOT EXISTS idx_exercices_company_id ON exercices_fiscaux(company_id);
	CREATE INDEX IF NOT EXISTS idx_retenues_company_id     ON retenues_source(company_id);
	CREATE INDEX IF NOT EXISTS idx_cnss_company_id         ON cnss_patronal(company_id);
	CREATE INDEX IF NOT EXISTS idx_prt_token               ON password_reset_tokens(token);
	CREATE INDEX IF NOT EXISTS idx_prt_user_id             ON password_reset_tokens(user_id);
	CREATE INDEX IF NOT EXISTS idx_rt_token                ON refresh_tokens(token);
	CREATE INDEX IF NOT EXISTS idx_rt_user_id              ON refresh_tokens(user_id);

	-- Index bulletins et TVA (ajouts idempotents)
	CREATE INDEX IF NOT EXISTS idx_bulletins_company_id         ON bulletins(company_id);
	CREATE INDEX IF NOT EXISTS idx_bulletins_company_period     ON bulletins(company_id, annee DESC, mois DESC);
	CREATE INDEX IF NOT EXISTS idx_tva_declarations_company_id  ON tva_declarations(company_id);
	CREATE INDEX IF NOT EXISTS idx_tva_declarations_period      ON tva_declarations(company_id, annee DESC, mois DESC);
	CREATE INDEX IF NOT EXISTS idx_retenues_company_period      ON retenues_source(company_id, annee DESC, mois DESC);
	CREATE INDEX IF NOT EXISTS idx_simulations_company_id       ON simulations(company_id);
	CREATE INDEX IF NOT EXISTS idx_wf_etapes_declaration_id     ON workflow_etapes(declaration_id);

	-- Migration idempotente : ajout colonne fsp sur bulletins existants
	ALTER TABLE bulletins ADD COLUMN IF NOT EXISTS fsp NUMERIC(12,2) NOT NULL DEFAULT 0;

	-- Migration idempotente : champs contribuable DGI sur companies
	ALTER TABLE companies ADD COLUMN IF NOT EXISTS forme_juridique    TEXT NOT NULL DEFAULT '';
	ALTER TABLE companies ADD COLUMN IF NOT EXISTS regime             TEXT NOT NULL DEFAULT '';
	ALTER TABLE companies ADD COLUMN IF NOT EXISTS centre_impots      TEXT NOT NULL DEFAULT '';
	ALTER TABLE companies ADD COLUMN IF NOT EXISTS code_activite      TEXT NOT NULL DEFAULT '';
	ALTER TABLE companies ADD COLUMN IF NOT EXISTS date_debut_activite DATE;
	ALTER TABLE companies ADD COLUMN IF NOT EXISTS email_entreprise   TEXT NOT NULL DEFAULT '';
	ALTER TABLE companies ADD COLUMN IF NOT EXISTS ville              TEXT NOT NULL DEFAULT '';
	ALTER TABLE companies ADD COLUMN IF NOT EXISTS quartier           TEXT NOT NULL DEFAULT '';
	ALTER TABLE companies ADD COLUMN IF NOT EXISTS bp                 TEXT NOT NULL DEFAULT '';
	ALTER TABLE companies ADD COLUMN IF NOT EXISTS fax                TEXT NOT NULL DEFAULT '';

	-- Unicité déclaration IUTS par entreprise/période (évite les doublons)
	CREATE UNIQUE INDEX IF NOT EXISTS idx_declarations_unique_period
	    ON declarations(company_id, mois, annee);

	-- ─── Modules fiscaux annuels (Sprint 1) ─────────────────────────────────

	CREATE TABLE IF NOT EXISTS irf_declarations (
		id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		annee       INT  NOT NULL,
		loyer_brut  NUMERIC(14,2) NOT NULL DEFAULT 0,
		abattement  NUMERIC(14,2) NOT NULL DEFAULT 0,
		base_nette  NUMERIC(14,2) NOT NULL DEFAULT 0,
		irf1        NUMERIC(14,2) NOT NULL DEFAULT 0,
		irf2        NUMERIC(14,2) NOT NULL DEFAULT 0,
		irf_total   NUMERIC(14,2) NOT NULL DEFAULT 0,
		loyer_net   NUMERIC(14,2) NOT NULL DEFAULT 0,
		statut      TEXT NOT NULL DEFAULT 'brouillon',
		ref         TEXT,
		created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS ircm_declarations (
		id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		annee        INT  NOT NULL,
		montant_brut NUMERIC(14,2) NOT NULL DEFAULT 0,
		type_revenu  TEXT NOT NULL DEFAULT 'CREANCES',
		taux         NUMERIC(8,4)  NOT NULL DEFAULT 0,
		ircm_total   NUMERIC(14,2) NOT NULL DEFAULT 0,
		montant_net  NUMERIC(14,2) NOT NULL DEFAULT 0,
		statut       TEXT NOT NULL DEFAULT 'brouillon',
		ref          TEXT,
		created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS is_declarations (
		id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		annee        INT  NOT NULL,
		ca           NUMERIC(14,2) NOT NULL DEFAULT 0,
		benefice     NUMERIC(14,2) NOT NULL DEFAULT 0,
		regime       TEXT NOT NULL DEFAULT 'reel',
		adhesion_cga BOOLEAN NOT NULL DEFAULT false,
		is_theorique NUMERIC(14,2) NOT NULL DEFAULT 0,
		mfp_du       NUMERIC(14,2) NOT NULL DEFAULT 0,
		is_du        NUMERIC(14,2) NOT NULL DEFAULT 0,
		statut       TEXT NOT NULL DEFAULT 'brouillon',
		ref          TEXT,
		created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS cme_declarations (
		id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		annee        INT  NOT NULL,
		ca           NUMERIC(14,2) NOT NULL DEFAULT 0,
		zone         TEXT NOT NULL DEFAULT 'A',
		adhesion_cga BOOLEAN NOT NULL DEFAULT false,
		classe       INT  NOT NULL DEFAULT 1,
		cme          NUMERIC(14,2) NOT NULL DEFAULT 0,
		cme_net      NUMERIC(14,2) NOT NULL DEFAULT 0,
		statut       TEXT NOT NULL DEFAULT 'brouillon',
		ref          TEXT,
		created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS patente_declarations (
		id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		annee           INT  NOT NULL,
		ca              NUMERIC(14,2) NOT NULL DEFAULT 0,
		valeur_locative NUMERIC(14,2) NOT NULL DEFAULT 0,
		droit_fixe      NUMERIC(14,2) NOT NULL DEFAULT 0,
		droit_prop      NUMERIC(14,2) NOT NULL DEFAULT 0,
		total_patente   NUMERIC(14,2) NOT NULL DEFAULT 0,
		statut          TEXT NOT NULL DEFAULT 'brouillon',
		ref             TEXT,
		created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_irf_company_id     ON irf_declarations(company_id);
	CREATE INDEX IF NOT EXISTS idx_ircm_company_id    ON ircm_declarations(company_id);
	CREATE INDEX IF NOT EXISTS idx_is_company_id      ON is_declarations(company_id);
	CREATE INDEX IF NOT EXISTS idx_cme_company_id     ON cme_declarations(company_id);
	CREATE INDEX IF NOT EXISTS idx_patente_company_id ON patente_declarations(company_id);

	-- ─── Sprint 2 : suivi lectures notifications ─────────────────────────────

	CREATE TABLE IF NOT EXISTS user_notif_reads (
		user_id  UUID NOT NULL,
		notif_id TEXT NOT NULL,
		read_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		PRIMARY KEY (user_id, notif_id)
	);

	-- ─── Super Admin (idempotent) ─────────────────────────────────────────────

	ALTER TABLE users ADD COLUMN IF NOT EXISTS role      TEXT    NOT NULL DEFAULT 'user';
	ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
	ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

	CREATE TABLE IF NOT EXISTS licenses (
		id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
		plan          TEXT NOT NULL DEFAULT 'starter',
		status        TEXT NOT NULL DEFAULT 'trial',
		trial_ends_at TIMESTAMPTZ,
		expires_at    TIMESTAMPTZ,
		max_companies INT  NOT NULL DEFAULT 1,
		max_employees INT  NOT NULL DEFAULT 50,
		notes         TEXT NOT NULL DEFAULT '',
		created_by    UUID REFERENCES users(id),
		created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS audit_logs (
		id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		admin_id    UUID NOT NULL REFERENCES users(id),
		action      TEXT NOT NULL,
		target_type TEXT NOT NULL DEFAULT '',
		target_id   TEXT,
		details     JSONB NOT NULL DEFAULT '{}',
		created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_licenses_user_id    ON licenses(user_id);
	CREATE INDEX IF NOT EXISTS idx_audit_logs_admin    ON audit_logs(admin_id);
	CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON audit_logs(created_at DESC);

	-- ─── Multi-tenant : Organisations (Personne Morale) ──────────────────────

	CREATE TABLE IF NOT EXISTS organizations (
		id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
		nom           TEXT    NOT NULL,
		ifu           TEXT    NOT NULL DEFAULT '',
		rccm          TEXT    NOT NULL DEFAULT '',
		secteur       TEXT    NOT NULL DEFAULT '',
		plan          TEXT    NOT NULL DEFAULT 'moral_team',
		max_users     INT     NOT NULL DEFAULT 5,
		max_companies INT     NOT NULL DEFAULT 2,
		max_employees INT     NOT NULL DEFAULT 200,
		owner_id      UUID,
		is_active     BOOLEAN NOT NULL DEFAULT TRUE,
		created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	-- Colonnes supplémentaires sur users (idempotentes)
	ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'physique';
	ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id    UUID REFERENCES organizations(id);
	ALTER TABLE users ADD COLUMN IF NOT EXISTS org_role  TEXT;

	-- Colonne org_id sur companies
	ALTER TABLE companies ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

	-- Accès des membres aux sociétés de l'organisation
	CREATE TABLE IF NOT EXISTS org_company_access (
		user_id    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
		company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		granted_by UUID REFERENCES users(id),
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		PRIMARY KEY (user_id, company_id)
	);

	CREATE INDEX IF NOT EXISTS idx_orgs_owner        ON organizations(owner_id);
	CREATE INDEX IF NOT EXISTS idx_users_org_id      ON users(org_id);
	CREATE INDEX IF NOT EXISTS idx_companies_org_id  ON companies(org_id);
	CREATE INDEX IF NOT EXISTS idx_oca_user          ON org_company_access(user_id);
	CREATE INDEX IF NOT EXISTS idx_oca_company       ON org_company_access(company_id);

	-- ─── Checklist fiscale (état coché par utilisateur) ──────────────────────

	CREATE TABLE IF NOT EXISTS checklist_state (
		user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		item_id    TEXT NOT NULL,
		checked    BOOLEAN NOT NULL DEFAULT TRUE,
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		PRIMARY KEY (user_id, item_id)
	);
	`
	_, err := pool.Exec(context.Background(), schema)
	if err != nil {
		return err
	}

	// Seed super admin depuis les variables d'environnement (idempotent)
	return seedSuperAdmin(pool)
}

// seedSuperAdmin crée le super admin à partir des variables d'env SUPERADMIN_EMAIL + SUPERADMIN_PASSWORD.
// Opération idempotente : si le compte existe déjà, rien ne se passe.
func seedSuperAdmin(pool *pgxpool.Pool) error {
	email := os.Getenv("SUPERADMIN_EMAIL")
	password := os.Getenv("SUPERADMIN_PASSWORD")
	if email == "" || password == "" {
		return nil // Super admin non configuré — OK en dev
	}

	var exists bool
	pool.QueryRow(context.Background(),
		`SELECT EXISTS(SELECT 1 FROM users WHERE email=$1 AND role='super_admin')`, email,
	).Scan(&exists)
	if exists {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("seed super admin: hash password: %w", err)
	}

	_, err = pool.Exec(context.Background(),
		`INSERT INTO users (email, password_hash, plan, role, is_active)
		 VALUES ($1, $2, 'enterprise', 'super_admin', TRUE)
		 ON CONFLICT (email) DO UPDATE SET role='super_admin', is_active=TRUE`,
		email, string(hash),
	)
	if err != nil {
		return fmt.Errorf("seed super admin: insert: %w", err)
	}
	fmt.Printf("[SUPERADMIN] Compte super admin créé : %s\n", email)
	return nil
}
