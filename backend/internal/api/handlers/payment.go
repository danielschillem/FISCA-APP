package handlers

import (
	"bytes"
	"context"
	cryptorand "crypto/rand"
	"encoding/json"
	hexenc "encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	mw "github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Tarif génération PDF : 2 000 FCFA + 1,5% frais Orange Money
const (
	PrixBase  = 2000.0
	TauxFrais = 0.015
)

// Types de documents autorisés
var docTypes = map[string]bool{
	"iuts":     true,
	"tva":      true,
	"retenues": true,
	"is":       true,
	"ircm":     true,
	"cme":      true,
	"irf":      true,
	"bulletin": true,
	"patente":  true,
	"cnss":     true,
}

var phoneRE = regexp.MustCompile(`^(\+226|00226)?[0-9]{8}$`)

type PaymentHandler struct {
	DB *pgxpool.Pool
}

func NewPaymentHandler(db *pgxpool.Pool) *PaymentHandler {
	return &PaymentHandler{DB: db}
}

// POST /api/payments/initiate
// Crée un paiement et envoie la demande à l'API Orange Money.
func (h *PaymentHandler) Initiate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := mw.GetUserID(r)
	companyID := mw.GetCompanyID(r)
	if companyID == "" {
		jsonError(w, "Entreprise non sélectionnée", http.StatusBadRequest)
		return
	}

	var req models.InitiatePaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Données invalides", http.StatusBadRequest)
		return
	}

	// Validation document_type
	if !docTypes[req.DocumentType] {
		jsonError(w, "Type de document invalide", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.DocumentID) == "" {
		jsonError(w, "document_id requis", http.StatusBadRequest)
		return
	}

	// Validation téléphone
	phone := strings.TrimSpace(req.Telephone)
	phone = strings.ReplaceAll(phone, " ", "")
	if !phoneRE.MatchString(phone) {
		jsonError(w, "Numéro Orange Money invalide (8 chiffres burkinabè)", http.StatusBadRequest)
		return
	}
	// Normaliser en +226XXXXXXXX
	phone = strings.TrimPrefix(phone, "00226")
	phone = strings.TrimPrefix(phone, "+226")
	if len(phone) == 8 {
		phone = "+226" + phone
	}

	// Montant
	base := PrixBase
	if req.MontantBase > 0 {
		base = req.MontantBase
	}
	frais := base * TauxFrais
	total := base + frais

	// Vérifier qu'un paiement complété n'existe pas déjà pour ce document
	var existingID string
	err := h.DB.QueryRow(ctx,
		`SELECT id FROM payments
		 WHERE company_id=$1 AND document_type=$2 AND document_id=$3 AND statut='completed'
		 LIMIT 1`,
		companyID, req.DocumentType, req.DocumentID,
	).Scan(&existingID)
	if err == nil && existingID != "" {
		// Paiement déjà effectué — retourner directement le succès
		jsonOK(w, map[string]any{
			"id":     existingID,
			"statut": "completed",
			"total":  total,
			"frais":  frais,
			"cached": true,
		})
		return
	}

	// Générer un order_id unique
	nonceBytes := make([]byte, 4)
	if _, err := cryptorand.Read(nonceBytes); err != nil {
		jsonError(w, "Erreur génération identifiant", http.StatusInternalServerError)
		return
	}
	nonce := hexenc.EncodeToString(nonceBytes)
	orderID := fmt.Sprintf("FISCA-%s-%s-%s", strings.ToUpper(req.DocumentType), time.Now().Format("200601"), nonce)

	// Insérer le paiement en base
	var paymentID string
	err = h.DB.QueryRow(ctx,
		`INSERT INTO payments
		   (company_id, user_id, document_type, document_id, montant_base, taux_frais, frais, total, telephone, statut, om_order_id)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10)
		 RETURNING id`,
		companyID, userID, req.DocumentType, req.DocumentID,
		base, TauxFrais, frais, total, phone, orderID,
	).Scan(&paymentID)
	if err != nil {
		log.Printf("[PAYMENT] insert error: %v", err)
		jsonError(w, "Erreur création paiement", http.StatusInternalServerError)
		return
	}

	// Appel API Orange Money (si configurée)
	omURL := os.Getenv("OM_API_URL")
	if omURL == "" {
		// Mode sandbox/mock — approuver automatiquement pour les tests
		log.Printf("[PAYMENT] OM_API_URL non configuré — mode mock, approbation automatique")
		h.DB.Exec(ctx, //nolint:errcheck
			`UPDATE payments SET statut='completed', om_reference='MOCK-'+$1, updated_at=NOW() WHERE id=$2`,
			orderID, paymentID,
		)
		jsonOK(w, map[string]any{
			"id":     paymentID,
			"statut": "completed",
			"total":  total,
			"frais":  frais,
			"mock":   true,
		})
		return
	}

	// Appel réel Orange Money API
	omErr := callOrangeMoney(ctx, omURL, orderID, phone, total, paymentID)
	if omErr != nil {
		log.Printf("[PAYMENT] Orange Money API error: %v", omErr)
		// Ne pas bloquer — le paiement est créé, le webhook peut encore arriver
		// Ou l'utilisateur peut retry
		h.DB.Exec(ctx, //nolint:errcheck
			`UPDATE payments SET statut='failed', updated_at=NOW() WHERE id=$1`, paymentID,
		)
		jsonError(w, "Erreur initialisation paiement Orange Money", http.StatusBadGateway)
		return
	}

	jsonOK(w, map[string]any{
		"id":     paymentID,
		"statut": "pending",
		"total":  total,
		"frais":  frais,
	})
}

// GET /api/payments/{id}/status
// Le frontend poll cette route pour savoir si le paiement est confirmé.
func (h *PaymentHandler) Status(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	paymentID := chi.URLParam(r, "id")
	companyID := mw.GetCompanyID(r)

	var p models.Payment
	err := h.DB.QueryRow(ctx,
		`SELECT id, company_id, document_type, document_id, total, frais, statut, updated_at
		 FROM payments WHERE id=$1 AND company_id=$2`,
		paymentID, companyID,
	).Scan(&p.ID, &p.CompanyID, &p.DocumentType, &p.DocumentID, &p.Total, &p.Frais, &p.Statut, &p.UpdatedAt)
	if err != nil {
		jsonError(w, "Paiement introuvable", http.StatusNotFound)
		return
	}

	// Si pending depuis plus de 10 min → expirer
	if p.Statut == "pending" && time.Since(p.UpdatedAt) > 10*time.Minute {
		h.DB.Exec(ctx, //nolint:errcheck
			`UPDATE payments SET statut='expired', updated_at=NOW() WHERE id=$1`, paymentID,
		)
		p.Statut = "expired"
	}

	jsonOK(w, models.PaymentStatusResponse{
		ID:     p.ID,
		Statut: p.Statut,
		Total:  p.Total,
		Frais:  p.Frais,
	})
}

// POST /api/payments/webhook  (route publique — appelée par Orange Money)
func (h *PaymentHandler) Webhook(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	// Vérification signature (header X-OM-Signature)
	// TODO: valider HMAC avec OM_WEBHOOK_SECRET quand disponible
	omSecret := os.Getenv("OM_WEBHOOK_SECRET")
	if omSecret != "" {
		sig := r.Header.Get("X-OM-Signature")
		if sig == "" {
			http.Error(w, "signature manquante", http.StatusUnauthorized)
			return
		}
		// TODO: vérifier HMAC-SHA256 de body avec omSecret
	}

	var payload struct {
		OrderID   string `json:"order_id"`
		Reference string `json:"reference"`
		Status    string `json:"status"` // "SUCCESS" | "FAILED"
		Amount    string `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "payload invalide", http.StatusBadRequest)
		return
	}

	if payload.OrderID == "" {
		http.Error(w, "order_id manquant", http.StatusBadRequest)
		return
	}

	statut := "failed"
	if strings.ToUpper(payload.Status) == "SUCCESS" {
		statut = "completed"
	}

	_, err := h.DB.Exec(ctx,
		`UPDATE payments
		 SET statut=$1, om_reference=$2, webhook_received=TRUE, updated_at=NOW()
		 WHERE om_order_id=$3 AND statut='pending'`,
		statut, payload.Reference, payload.OrderID,
	)
	if err != nil {
		log.Printf("[PAYMENT WEBHOOK] update error: %v", err)
		http.Error(w, "erreur interne", http.StatusInternalServerError)
		return
	}

	log.Printf("[PAYMENT WEBHOOK] order=%s status=%s ref=%s", payload.OrderID, statut, payload.Reference)
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"ok":true}`)) //nolint:errcheck
}

// GET /api/payments?document_type=iuts&document_id=xxx  (vérification rapide)
func (h *PaymentHandler) Check(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	companyID := mw.GetCompanyID(r)
	docType := r.URL.Query().Get("document_type")
	docID := r.URL.Query().Get("document_id")

	if docType == "" || docID == "" {
		jsonError(w, "document_type et document_id requis", http.StatusBadRequest)
		return
	}

	var paymentID string
	err := h.DB.QueryRow(ctx,
		`SELECT id FROM payments
		 WHERE company_id=$1 AND document_type=$2 AND document_id=$3 AND statut='completed'
		 ORDER BY created_at DESC LIMIT 1`,
		companyID, docType, docID,
	).Scan(&paymentID)

	paid := err == nil && paymentID != ""
	jsonOK(w, map[string]any{"paid": paid, "payment_id": paymentID})
}

// ─── Appel API Orange Money ───────────────────────────────────────────────────

// callOrangeMoney envoie la demande de paiement à l'API OM.
// La structure exacte dépend de votre contrat avec Orange Money.
// Configurez OM_API_URL, OM_API_KEY, OM_MERCHANT_ID dans les variables d'env.
func callOrangeMoney(ctx context.Context, baseURL, orderID, phone string, amount float64, paymentID string) error {
	callbackURL := os.Getenv("APP_BASE_URL") + "/api/payments/webhook"
	merchantID := os.Getenv("OM_MERCHANT_ID")
	apiKey := os.Getenv("OM_API_KEY")

	payload := map[string]any{
		"merchant_id":  merchantID,
		"order_id":     orderID,
		"amount":       int(amount),
		"currency":     "XOF",
		"phone":        phone,
		"callback_url": callbackURL,
		"description":  "Génération document fiscal FISCA",
		"payment_id":   paymentID,
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/initiate", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("X-Merchant-ID", merchantID)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("orange money unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("orange money error HTTP %d", resp.StatusCode)
	}
	return nil
}
