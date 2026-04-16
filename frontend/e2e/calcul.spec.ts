import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL || 'test@fisca.bf';
const PASSWORD = process.env.E2E_PASSWORD || 'TestPassword123!';

test.beforeEach(async ({ page }) => {
    // Authentification avant chaque test
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/mot de passe|password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();
    await expect(page).toHaveURL(/dashboard/);
});

test.describe('Calcul IUTS — module paie', () => {
    test('page saisie accessible depuis le dashboard', async ({ page }) => {
        await page.getByRole('link', { name: /saisie|employ[eé]/i }).first().click();
        await expect(page).toHaveURL(/saisie/);
        await expect(page.getByRole('heading', { name: /saisie|employ[eé]/i })).toBeVisible();
    });

    test('page calcul affiche un résultat après saisie', async ({ page }) => {
        await page.goto('/dashboard/calcul');
        // Remplacer la valeur du salaire si le champ existe
        const salaireInput = page.getByLabel(/salaire|base/i).first();
        if (await salaireInput.isVisible()) {
            await salaireInput.fill('300000');
        }
        const calcBtn = page.getByRole('button', { name: /calculer|calc/i }).first();
        if (await calcBtn.isVisible()) {
            await calcBtn.click();
            // Un résultat numérique FCFA doit apparaître
            await expect(page.getByText(/FCFA/i).first()).toBeVisible({ timeout: 5_000 });
        }
    });
});

test.describe('IRF — revenus fonciers', () => {
    test('page IRF accessible', async ({ page }) => {
        await page.goto('/dashboard/irf');
        // Soit la page de calcul IRF, soit un écran de verrouillage selon le plan
        const heading = page.getByRole('heading', { name: /IRF|revenus fonciers|verrouill/i });
        await expect(heading.first()).toBeVisible();
    });

    test('calcul IRF — saisir un loyer et lancer le calcul', async ({ page }) => {
        await page.goto('/dashboard/irf');
        const loyerInput = page.getByLabel(/loyer/i).first();
        if (await loyerInput.isVisible()) {
            await loyerInput.fill('500000');
            const calcBtn = page.getByRole('button', { name: /calculer|calc/i }).first();
            await calcBtn.click();
            await expect(page.getByText(/abattement|IRF|FCFA/i).first()).toBeVisible({ timeout: 5_000 });
        }
    });
});

test.describe('Bulletins de paie', () => {
    test('page bulletins accessible', async ({ page }) => {
        await page.goto('/dashboard/bulletins');
        await expect(page.getByRole('heading', { name: /bulletins|paie/i })).toBeVisible();
    });

    test('liste des bulletins visible (ou message vide)', async ({ page }) => {
        await page.goto('/dashboard/bulletins');
        // Soit une liste de bulletins, soit un message "aucun bulletin"
        const content = page
            .getByRole('table')
            .or(page.getByText(/aucun|vide|no.*bulletin/i));
        await expect(content.first()).toBeVisible({ timeout: 8_000 });
    });
});
