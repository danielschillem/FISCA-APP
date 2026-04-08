package db

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
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
	config.MaxConns = 10

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return nil, fmt.Errorf("connexion DB: %w", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
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
	`
	_, err := pool.Exec(context.Background(), schema)
	return err
}
