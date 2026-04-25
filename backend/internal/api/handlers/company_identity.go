package handlers

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func normalizeIFU(ifu string) string {
	replacer := strings.NewReplacer(" ", "", "-", "", ".", "", "_", "")
	return strings.ToUpper(replacer.Replace(strings.TrimSpace(ifu)))
}

func ensureIFUAvailable(db *pgxpool.Pool, companyID, rawIFU string) error {
	norm := normalizeIFU(rawIFU)
	if norm == "" {
		return nil
	}
	var existingID string
	err := db.QueryRow(
		context.Background(),
		`SELECT id
		   FROM companies
		  WHERE UPPER(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(ifu,''), ' ', ''), '-', ''), '.', ''), '_', '')) = $1
		    AND id <> $2
		  LIMIT 1`,
		norm, companyID,
	).Scan(&existingID)
	if err == nil && existingID != "" {
		return errors.New("ifu_already_used")
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	return nil
}
