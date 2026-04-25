package handlers

import (
	"bytes"
	"context"
	cryptorand "crypto/rand"
	"crypto/tls"
	"crypto/x509"
	hexenc "encoding/hex"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	mw "github.com/fisca-app/backend/internal/api/middleware"
	"github.com/fisca-app/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Tarifs génération PDF + 1,5% frais Orange Money
const (
	TauxFrais = 0.015
)

// Types de documents autorisés
var docTypes = map[string]bool{
	"iuts":            true,
	"tva":             true,
	"retenues":        true,
	"is":              true,
	"ircm":            true,
	"cme":             true,
	"irf":             true,
	"bulletin":        true,
	"patente":         true,
	"cnss":            true,
	"annexe":          true,
	"duplicata":       true,
	"annexe_bulletin": true,
}

var prixBaseByDocType = map[string]float64{
	"iuts":            2000,
	"tva":             2000,
	"retenues":        2000,
	"is":              2000,
	"ircm":            2000,
	"cme":             2000,
	"irf":             2000,
	"patente":         2000,
	"cnss":            2000,
	"annexe":          5000,
	"duplicata":       3000,
	"bulletin":        5000,
	"annexe_bulletin": 8000,
}

var phoneRE = regexp.MustCompile(`^(\+226|00226)?[0-9]{8}$`)
var otpRE = regexp.MustCompile(`^[0-9]{6}$`)
var uuidRE = regexp.MustCompile(`^[0-9a-fA-F-]{36}$`)

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
	if err := h.validateDocumentOwnership(ctx, companyID, req.DocumentType, req.DocumentID); err != nil {
		jsonError(w, err.Error(), http.StatusForbidden)
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
	otp := strings.TrimSpace(req.OTP)
	if !otpRE.MatchString(otp) {
		jsonError(w, "Code OTP invalide (6 chiffres requis)", http.StatusBadRequest)
		return
	}

	// Montant
	base := prixBaseByDocType[req.DocumentType]
	if base <= 0 {
		base = 2000
	}
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
		// Paiement déjà effectué - retourner directement le succès
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
	omURL := resolveOMURL()
	if omURL == "" {
		// Mode sandbox/mock - approuver automatiquement pour les tests
		log.Printf("[PAYMENT] URL Orange Money non configurée - mode mock, approbation automatique")
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
	omErr := callOrangeMoney(ctx, omURL, orderID, phone, total, otp, paymentID)
	if omErr != nil {
		log.Printf("[PAYMENT] Orange Money API error: %v", omErr)
		// Ne pas bloquer - le paiement est créé, le webhook peut encore arriver
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

func (h *PaymentHandler) validateDocumentOwnership(ctx context.Context, companyID, docType, docID string) error {
	// IDs synthétiques autorisés pour les exports "pack" côté contribuable.
	if !uuidRE.MatchString(docID) {
		switch docType {
		case "annexe", "duplicata", "annexe_bulletin", "bulletin":
			return nil
		default:
			return fmt.Errorf("document non autorisé pour cette société")
		}
	}

	queryByType := map[string]string{
		"iuts":     `SELECT 1 FROM declarations WHERE id=$1 AND company_id=$2`,
		"tva":      `SELECT 1 FROM tva_declarations WHERE id=$1 AND company_id=$2`,
		"retenues": `SELECT 1 FROM retenues_source WHERE id=$1 AND company_id=$2`,
		"is":       `SELECT 1 FROM is_declarations WHERE id=$1 AND company_id=$2`,
		"ircm":     `SELECT 1 FROM ircm_declarations WHERE id=$1 AND company_id=$2`,
		"cme":      `SELECT 1 FROM cme_declarations WHERE id=$1 AND company_id=$2`,
		"irf":      `SELECT 1 FROM irf_declarations WHERE id=$1 AND company_id=$2`,
		"patente":  `SELECT 1 FROM patente_declarations WHERE id=$1 AND company_id=$2`,
		"cnss":     `SELECT 1 FROM cnss_patronal WHERE id=$1 AND company_id=$2`,
		"bulletin": `SELECT 1 FROM bulletins WHERE id=$1 AND company_id=$2`,
	}
	q, ok := queryByType[docType]
	if !ok {
		return nil
	}
	var one int
	if err := h.DB.QueryRow(ctx, q, docID, companyID).Scan(&one); err != nil {
		return fmt.Errorf("document non autorisé pour cette société")
	}
	return nil
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

// POST /api/payments/webhook  (route publique - appelée par Orange Money)
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

// --- Appel API Orange Money ---------------------------------------------------

type omCommand struct {
	XMLName        xml.Name `xml:"COMMAND"`
	Type           string   `xml:"TYPE"`
	CustomerMSISDN string   `xml:"customer_msisdn"`
	MerchantMSISDN string   `xml:"merchant_msisdn"`
	APIUsername    string   `xml:"api_username"`
	APIPassword    string   `xml:"api_password"`
	Amount         string   `xml:"amount"`
	Provider       string   `xml:"PROVIDER"`
	Provider2      string   `xml:"PROVIDER2"`
	PayID          string   `xml:"PAYID"`
	PayID2         string   `xml:"PAYID2"`
	OTP            string   `xml:"otp"`
	Reference      string   `xml:"reference_number"`
	ExtTxnID       string   `xml:"ext_txn_id"`
}

type omResponse struct {
	Status  string `xml:"status"`
	Message string `xml:"message"`
	TransID string `xml:"transID"`
}

func normalizeBFPhone(raw string) string {
	p := strings.TrimSpace(raw)
	p = strings.ReplaceAll(p, " ", "")
	p = strings.TrimPrefix(p, "+226")
	p = strings.TrimPrefix(p, "00226")
	return p
}

func buildOMHTTPClient() (*http.Client, error) {
	certFile := strings.TrimSpace(os.Getenv("OM_TLS_CERT_FILE"))
	keyFile := strings.TrimSpace(os.Getenv("OM_TLS_KEY_FILE"))
	caFile := strings.TrimSpace(os.Getenv("OM_TLS_CA_FILE"))
	if certFile == "" || keyFile == "" {
		return &http.Client{Timeout: 25 * time.Second}, nil
	}

	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return nil, fmt.Errorf("chargement cert/key OM impossible: %w", err)
	}

	tlsCfg := &tls.Config{
		MinVersion:   tls.VersionTLS12,
		Certificates: []tls.Certificate{cert},
	}
	if caFile != "" {
		caPem, readErr := os.ReadFile(caFile)
		if readErr != nil {
			return nil, fmt.Errorf("lecture OM_TLS_CA_FILE impossible: %w", readErr)
		}
		pool := x509.NewCertPool()
		if ok := pool.AppendCertsFromPEM(caPem); !ok {
			return nil, fmt.Errorf("OM_TLS_CA_FILE invalide (PEM)")
		}
		tlsCfg.RootCAs = pool
	}

	return &http.Client{
		Timeout:   25 * time.Second,
		Transport: &http.Transport{TLSClientConfig: tlsCfg},
	}, nil
}

func envFirst(keys ...string) string {
	for _, k := range keys {
		v := strings.TrimSpace(os.Getenv(k))
		if v != "" {
			return v
		}
	}
	return ""
}

func envTruthy(key string) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

func resolveOMURL() string {
	// Override explicite prioritaire (si vous voulez forcer une URL unique).
	if direct := envFirst("ORANGE_MONEY_API_URL", "OM_API_URL"); direct != "" {
		return direct
	}

	// Sélection par environnement (dernière passe prod-ready).
	omEnv := strings.ToLower(envFirst("ORANGE_MONEY_ENV"))
	appEnv := strings.ToLower(envFirst("APP_ENV", "ENV"))
	useProd := omEnv == "prod" || omEnv == "production" || appEnv == "prod" || appEnv == "production" || envTruthy("ORANGE_MONEY_USE_PROD")

	if useProd {
		return envFirst("ORANGE_MONEY_PROD_URL")
	}
	return envFirst("ORANGE_MONEY_TEST_URL")
}

// callOrangeMoney envoie la demande XML OMPREQ à l'API OM.
// Variables: ORANGE_MONEY_API_URL (ou ORANGE_MONEY_TEST_URL), ORANGE_MONEY_API_USERNAME,
// ORANGE_MONEY_API_PASSWORD, ORANGE_MONEY_MERCHANT_MSISDN.
// Optionnelles: ORANGE_MONEY_PROVIDER/ORANGE_MONEY_PROVIDER2 (101),
// ORANGE_MONEY_PAYID/ORANGE_MONEY_PAYID2 (12).
func callOrangeMoney(ctx context.Context, baseURL, orderID, phone string, amount float64, otp string, _ string) error {
	username := envFirst("ORANGE_MONEY_API_USERNAME", "OM_API_USERNAME")
	password := envFirst("ORANGE_MONEY_API_PASSWORD", "OM_API_PASSWORD")
	merchantMSISDN := envFirst("ORANGE_MONEY_MERCHANT_MSISDN", "OM_MERCHANT_MSISDN")
	provider := envFirst("ORANGE_MONEY_PROVIDER", "OM_PROVIDER")
	provider2 := envFirst("ORANGE_MONEY_PROVIDER2", "OM_PROVIDER2")
	payID := envFirst("ORANGE_MONEY_PAYID", "OM_PAYID")
	payID2 := envFirst("ORANGE_MONEY_PAYID2", "OM_PAYID2")

	if username == "" || password == "" || merchantMSISDN == "" {
		return fmt.Errorf("configuration OM manquante: OM_API_USERNAME/OM_API_PASSWORD/OM_MERCHANT_MSISDN")
	}
	if provider == "" {
		provider = "101"
	}
	if provider2 == "" {
		provider2 = provider
	}
	if payID == "" {
		payID = "12"
	}
	if payID2 == "" {
		payID2 = payID
	}
	cmd := omCommand{
		Type:           "OMPREQ",
		CustomerMSISDN: normalizeBFPhone(phone),
		MerchantMSISDN: normalizeBFPhone(merchantMSISDN),
		APIUsername:    username,
		APIPassword:    password,
		Amount:         strconv.Itoa(int(amount)),
		Provider:       provider,
		Provider2:      provider2,
		PayID:          payID,
		PayID2:         payID2,
		OTP:            otp,
		Reference:      orderID,
		ExtTxnID:       orderID,
	}
	payload, err := xml.Marshal(cmd)
	if err != nil {
		return fmt.Errorf("construction xml OMPREQ impossible: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		strings.TrimRight(baseURL, "/"),
		bytes.NewReader(append([]byte(xml.Header), payload...)),
	)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/xml")
	req.Header.Set("Accept", "application/xml")

	client, err := buildOMHTTPClient()
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("orange money unreachable: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("orange money error HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var rpc omResponse
	if uErr := xml.Unmarshal(raw, &rpc); uErr != nil {
		return fmt.Errorf("réponse OM non parsable: %v - raw: %s", uErr, strings.TrimSpace(string(raw)))
	}
	if strings.TrimSpace(rpc.Status) != "200" {
		return fmt.Errorf("OM refusé status=%s message=%s", rpc.Status, rpc.Message)
	}
	return nil
}
