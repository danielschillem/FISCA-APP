// Package mailer gère l'envoi d'emails via SMTP.
// Variables d'environnement requises :
//
//	SMTP_HOST     — serveur SMTP (ex: smtp.sendgrid.net)
//	SMTP_PORT     — port (ex: 587)
//	SMTP_USER     — identifiant
//	SMTP_PASS     — mot de passe / clé API
//	SMTP_FROM     — adresse expéditeur (ex: noreply@fisca.bf)
//	APP_URL       — URL de base de l'application (ex: https://app.fisca.bf)
package mailer

import (
	"fmt"
	"os"
	"strconv"

	mail "github.com/wneessen/go-mail"
)

// Send envoie un email HTML simple.
func Send(to, subject, htmlBody string) error {
	host := os.Getenv("SMTP_HOST")
	if host == "" {
		// Pas de mailer configuré — log et sortie silencieuse
		fmt.Printf("[MAILER] (non configuré) To=%s Subject=%s\n", to, subject)
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
  <h2 style="color:#1a3c2e">FISCA — Réinitialisation du mot de passe</h2>
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

// SendWelcome envoie l'email de bienvenue après inscription.
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
