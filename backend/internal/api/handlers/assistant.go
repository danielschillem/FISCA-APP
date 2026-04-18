package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/fisca-app/backend/internal/api/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AssistantHandler struct {
	DB *pgxpool.Pool
}

func NewAssistantHandler(db *pgxpool.Pool) *AssistantHandler {
	return &AssistantHandler{DB: db}
}

// POST /api/assistant
func (h *AssistantHandler) Chat(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Message) == "" {
		jsonError(w, "message requis", http.StatusBadRequest)
		return
	}
	if len(req.Message) > 2000 {
		jsonError(w, "Message trop long (max 2000 caractères)", http.StatusBadRequest)
		return
	}

	// Construire le contexte fiscal de l'utilisateur
	context := h.buildContext(r, userID)

	openaiKey := os.Getenv("OPENAI_API_KEY")
	mistralKey := os.Getenv("MISTRAL_API_KEY")

	if openaiKey == "" && mistralKey == "" {
		// Aucune IA configurée - réponse de secours
		jsonOK(w, map[string]string{
			"reply": "L'assistant IA n'est pas encore configuré. Activez OPENAI_API_KEY (OpenAI) ou MISTRAL_API_KEY (Mistral, gratuit) dans les variables d'environnement.",
		})
		return
	}

	var reply string
	var err error
	if openaiKey != "" {
		reply, err = callOpenAI(openaiKey, context, req.Message)
	} else {
		reply, err = callMistral(mistralKey, context, req.Message)
	}
	if err != nil {
		// A09 OWASP : ne pas exposer les détails internes de l'erreur (clé API, quota, etc.)
		fmt.Printf("[ASSISTANT] Erreur provider IA pour user %s: %v\n", userID, err)
		jsonError(w, "L'assistant IA est temporairement indisponible. Veuillez réessayer.", http.StatusBadGateway)
		return
	}

	jsonOK(w, map[string]string{"reply": reply})
}

// buildContext construit un résumé textuel des données fiscales de l'entreprise
// pour enrichir le prompt système.
func (h *AssistantHandler) buildContext(r *http.Request, userID string) string {
	var companyID, nomEntreprise, ifu string
	h.DB.QueryRow(r.Context(),
		`SELECT c.id, c.nom, COALESCE(c.ifu,'')
		 FROM companies c WHERE c.user_id=$1 LIMIT 1`, userID,
	).Scan(&companyID, &nomEntreprise, &ifu)

	var nbEmployes int
	h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM employees WHERE company_id=$1`, companyID).Scan(&nbEmployes)

	now := time.Now()
	var iutsTotal, tpaTotal, brutTotal float64
	var nbDecl int
	h.DB.QueryRow(r.Context(),
		`SELECT COALESCE(SUM(iuts_total),0), COALESCE(SUM(tpa_total),0),
		        COALESCE(SUM(brut_total),0), COUNT(*)
		 FROM declarations WHERE company_id=$1 AND annee=$2`, companyID, now.Year(),
	).Scan(&iutsTotal, &tpaTotal, &brutTotal, &nbDecl)

	return fmt.Sprintf(`Tu es FISCA, un assistant fiscal expert spécialisé dans la fiscalité des entreprises au Burkina Faso (CGI 2025, LF 2020).

Contexte de l'entreprise connectée :
- Entreprise : %s (IFU: %s)
- Nombre d'employés : %d
- Année fiscale : %d
- Déclarations IUTS déposées cette année : %d
- Masse salariale brute annuelle : %.0f FCFA
- IUTS total annuel : %.0f FCFA
- TPA total annuel : %.0f FCFA

Règles de réponse STRICTES :
1. Réponds UNIQUEMENT en français, de manière claire, concise et professionnelle.
2. N'utilise JAMAIS de markdown : pas de #, ##, ###, **, *, |, ---, ni aucun autre symbole de formatage.
3. Structure tes réponses avec des numéros (1. 2. 3.) ou des tirets simples (-) pour les listes.
4. Pour les tableaux, présente les données sous forme de liste numérotée ou de phrases claires.
5. Ne fournis pas de conseils juridiques définitifs - recommande de consulter un expert-comptable pour les cas complexes.
6. Sois précis sur les chiffres, taux et articles du CGI Burkina Faso.`,
		nomEntreprise, ifu, nbEmployes, now.Year(), nbDecl, brutTotal, iutsTotal, tpaTotal)
}

// callMistral appelle l'API Mistral AI (compatible OpenAI) - modèle gratuit mistral-small-latest.
func callMistral(apiKey, systemContext, userMessage string) (string, error) {
	payload := map[string]any{
		"model": "mistral-small-latest",
		"messages": []map[string]string{
			{"role": "system", "content": systemContext},
			{"role": "user", "content": userMessage},
		},
		"max_tokens":  800,
		"temperature": 0.4,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", "https://api.mistral.ai/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Mistral HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil || len(result.Choices) == 0 {
		return "", fmt.Errorf("réponse Mistral invalide")
	}
	return result.Choices[0].Message.Content, nil
}

// callOpenAI appelle l'API OpenAI Chat Completions.
func callOpenAI(apiKey, systemContext, userMessage string) (string, error) {
	payload := map[string]any{
		"model": "gpt-4o-mini",
		"messages": []map[string]string{
			{"role": "system", "content": systemContext},
			{"role": "user", "content": userMessage},
		},
		"max_tokens":  800,
		"temperature": 0.4,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("OpenAI HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil || len(result.Choices) == 0 {
		return "", fmt.Errorf("réponse OpenAI invalide")
	}
	return result.Choices[0].Message.Content, nil
}
