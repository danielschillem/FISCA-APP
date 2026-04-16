import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL || 'test@fisca.bf';
const PASSWORD = process.env.E2E_PASSWORD || 'TestPassword123!';

test.describe('Authentification FISCA-APP', () => {
  test('login réussi → redirigé vers dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/mot de passe|password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

    // Vérifier la redirection vers le dashboard
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('identifiants invalides → message d\'erreur', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('invalide@fisca.bf');
    await page.getByLabel(/mot de passe|password/i).fill('mauvais-mdp');
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();

    // Message d'erreur visible — pas de redirection
    await expect(page).toHaveURL(/login/);
    const erreur = page.getByRole('alert').or(page.getByText(/invalide|incorrect|erreur/i));
    await expect(erreur.first()).toBeVisible({ timeout: 5_000 });
  });

  test('logout → redirigé vers /login', async ({ page }) => {
    // Login d'abord
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/mot de passe|password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();
    await expect(page).toHaveURL(/dashboard/);

    // Déconnexion — bouton dans sidebar ou menu utilisateur
    const logoutBtn = page
      .getByRole('button', { name: /d[ée]connexion|logout|quitter/i })
      .or(page.getByTitle(/d[ée]connexion|logout/i));
    await logoutBtn.first().click();

    await expect(page).toHaveURL(/login/);
  });

  test('accès direct au dashboard sans auth → redirigé vers /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });
});
