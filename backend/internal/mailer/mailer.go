// Package mailer gère l'envoi d'emails via SMTP.
// Variables d'environnement requises :
//
//	SMTP_HOST   - serveur SMTP (ex: smtp.sendgrid.net)
//	SMTP_PORT   - port (ex: 587)
//	SMTP_USER   - identifiant
//	SMTP_PASS   - mot de passe / clé API
//	SMTP_FROM   - adresse expéditeur (ex: noreply@fisca.bf)
//	APP_URL     - URL de base de l'application (ex: https://app.fisca.bf)
package mailer

import (
	"fmt"
	"log"
	"os"
	"strconv"

	mail "github.com/wneessen/go-mail"
)

// Send envoie un email HTML simple.
func Send(to, subject, htmlBody string) error {
	host := os.Getenv("SMTP_HOST")
	if host == "" {
		// Pas de mailer configuré - log et sortie silencieuse
		log.Printf("[MAILER] (non configuré) To=%s Subject=%s", to, subject)
		return nil
	}

	portStr := os.Getenv("SMTP_PORT")
	port, _ := strconv.Atoi(portStr)
	if port == 0 {
		port = 587
	}
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")
	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = "noreply@fisca.bf"
	}

	m := mail.NewMsg()
	if err := m.From(from); err != nil {
		return fmt.Errorf("mailer from: %w", err)
	}
	if err := m.To(to); err != nil {
		return fmt.Errorf("mailer to: %w", err)
	}
	m.Subject(subject)
	m.SetBodyString(mail.TypeTextHTML, htmlBody)

	opts := []mail.Option{
		mail.WithPort(port),
		mail.WithSMTPAuth(mail.SMTPAuthPlain),
		mail.WithUsername(user),
		mail.WithPassword(pass),
		mail.WithTLSPortPolicy(mail.TLSOpportunistic),
	}

	client, err := mail.NewClient(host, opts...)
	if err != nil {
		return fmt.Errorf("mailer client: %w", err)
	}
	return client.DialAndSend(m)
}

// SendResetPassword envoie l'email de réinitialisation de mot de passe.
func SendResetPassword(to, token string) error {
	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}
	link := fmt.Sprintf("%s/reset-password?token=%s", appURL, token)
	subject := "Réinitialisation de votre mot de passe FISCA"
	body := fmt.Sprintf(`<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
  <h2 style="color:#1a3c2e">FISCA - Réinitialisation du mot de passe</h2>
  <p>Bonjour,</p>
  <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le lien ci-dessous (valide 1 heure) :</p>
  <p style="margin:24px 0">
    <a href="%s" style="background:#1a3c2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
      Réinitialiser mon mot de passe
    </a>
  </p>
  <p style="color:#666;font-size:12px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email. Votre mot de passe ne sera pas modifié.</p>
  <p style="color:#666;font-size:12px">Lien direct : %s</p>
</body>
</html>`, link, link)
	return Send(to, subject, body)
}

// SendInvitation envoie les credentials d'accès à un nouveau membre invité par un org_admin.
func SendInvitation(to, orgNom, invitedByEmail, password, orgRole string) error {
	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}
	roleLabels := map[string]string{
		"org_admin":       "Administrateur",
		"comptable":       "Comptable",
		"gestionnaire_rh": "Gestionnaire RH",
		"auditeur":        "Auditeur (lecture seule)",
	}
	roleLabel := roleLabels[orgRole]
	if roleLabel == "" {
		roleLabel = orgRole
	}
	subject := fmt.Sprintf("Invitation FISCA - %s vous a ajouté à %s", invitedByEmail, orgNom)
	body := fmt.Sprintf(`<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#1e293b">
  <div style="background:linear-gradient(135deg,#16a34a,#059669);padding:24px;border-radius:12px;margin-bottom:24px">
    <h1 style="color:#fff;margin:0;font-size:22px">FISCA</h1>
    <p style="color:#d1fae5;margin:4px 0 0;font-size:13px">Plateforme Fiscale - Burkina Faso</p>
  </div>
  <h2 style="color:#1a3c2e">Vous avez été invité(e) sur FISCA</h2>
  <p><strong>%s</strong> vous a ajouté(e) à l'organisation <strong>%s</strong> avec le rôle <strong>%s</strong>.</p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0">
    <h3 style="margin:0 0 12px;font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Vos identifiants de connexion</h3>
    <p style="margin:6px 0"><strong>Email :</strong> %s</p>
    <p style="margin:6px 0"><strong>Mot de passe temporaire :</strong> <code style="background:#e2e8f0;padding:2px 8px;border-radius:4px;font-size:14px">%s</code></p>
    <p style="margin:12px 0 0;font-size:12px;color:#94a3b8">Changez votre mot de passe dès votre première connexion depuis Paramètres.</p>
  </div>
  <p style="margin:24px 0">
    <a href="%s/login" style="background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">
      Se connecter à FISCA
    </a>
  </p>
  <p style="color:#94a3b8;font-size:12px">Si vous ne vous attendiez pas à recevoir cet email, ignorez-le. Pour toute question : <a href="mailto:support@fisca.bf" style="color:#16a34a">support@fisca.bf</a></p>
</body>
</html>`, invitedByEmail, orgNom, roleLabel, to, password, appURL)
	return Send(to, subject, body)
}
func SendWelcome(to, nomEntreprise string) error {
	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}
	subject := "Bienvenue sur FISCA !"
	body := fmt.Sprintf(`<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
  <h2 style="color:#1a3c2e">Bienvenue sur FISCA, %s !</h2>
  <p>Votre compte a été créé avec succès. Vous pouvez dès maintenant gérer vos déclarations fiscales IUTS/TPA.</p>
  <p style="margin:24px 0">
    <a href="%s/dashboard" style="background:#1a3c2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
      Accéder au tableau de bord
    </a>
  </p>
</body>
</html>`, nomEntreprise, appURL)
	return Send(to, subject, body)
}
