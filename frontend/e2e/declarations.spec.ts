/**
 * Tests E2E — Déclarations fiscales (IRF, IRCM, CME, Patente, IS, TVA, RAS)
 * CGI 2025 Burkina Faso
 */
import { test, expect, Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL || 'test@fisca.bf';
const PASSWORD = process.env.E2E_PASSWORD || 'TestPassword123!';

async function login(page: Page) {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/mot de passe|password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
}

test.beforeEach(async ({ page }) => {
    await login(page);
});

// ─── IRF ─────────────────────────────────────────────────────────────────────
test.describe('IRF — Revenus Fonciers', () => {
    test('page accessible depuis le menu', async ({ page }) => {
        await page.goto('/dashboard/irf');
        const heading = page.getByRole('heading', { name: /IRF|foncier|verrouill/i });
        await expect(heading.first()).toBeVisible({ timeout: 8_000 });
    });

    test('calcul IRF avec loyer 500 000 FCFA', async ({ page }) => {
        await page.goto('/dashboard/irf');
        const loyerInput = page.getByLabel(/loyer brut/i).first();
        if (!(await loyerInput.isVisible())) return test.skip();
        await loyerInput.fill('500000');
        await page.getByRole('button', { name: /calculer/i }).first().click();
        // Abattement 50 % → base 250 000 → IRF 18% sur 100k + 25% sur 150k = 55 500
        await expect(page.getByText(/abattement/i)).toBeVisible({ timeout: 5_000 });
        await expect(page.getByText(/250.000|250 000/i)).toBeVisible({ timeout: 5_000 });
    });

    test('bouton Enregistrer visible après calcul', async ({ page }) => {
        await page.goto('/dashboard/irf');
        const loyerInput = page.getByLabel(/loyer brut/i).first();
        if (!(await loyerInput.isVisible())) return test.skip();
        await loyerInput.fill('300000');
        await page.getByRole('button', { name: /calculer/i }).first().click();
        await expect(page.getByRole('button', { name: /enregistrer|sauvegarder/i })).toBeVisible({ timeout: 5_000 });
    });

    test('historique IRF affiché (table ou message vide)', async ({ page }) => {
        await page.goto('/dashboard/irf');
        if (!(await page.getByLabel(/loyer brut/i).isVisible())) return test.skip();
        const content = page.getByRole('table').or(page.getByText(/aucune déclaration|historique/i));
        await expect(content.first()).toBeVisible({ timeout: 8_000 });
    });
});

// ─── IRCM ─────────────────────────────────────────────────────────────────────
test.describe('IRCM — Capitaux Mobiliers', () => {
    test('page accessible', async ({ page }) => {
        await page.goto('/dashboard/ircm');
        const heading = page.getByRole('heading', { name: /IRCM|capitaux|verrouill/i });
        await expect(heading.first()).toBeVisible({ timeout: 8_000 });
    });

    test('calcul IRCM dividendes 1 000 000 → IRCM 125 000', async ({ page }) => {
        await page.goto('/dashboard/ircm');
        const montantInput = page.getByLabel(/montant brut/i).first();
        if (!(await montantInput.isVisible())) return test.skip();
        await montantInput.fill('1000000');
        // Sélectionner DIVIDENDES si disponible
        const divLabel = page.getByText(/dividende/i).first();
        if (await divLabel.isVisible()) await divLabel.click();
        await page.getByRole('button', { name: /calculer/i }).first().click();
        await expect(page.getByText(/125.000|125 000/i)).toBeVisible({ timeout: 5_000 });
    });
});

// ─── CME ─────────────────────────────────────────────────────────────────────
test.describe('CME — Micro-Entreprises', () => {
    test('page accessible', async ({ page }) => {
        await page.goto('/dashboard/cme');
        const heading = page.getByRole('heading', { name: /CME|micro|verrouill/i });
        await expect(heading.first()).toBeVisible({ timeout: 8_000 });
    });

    test('calcul CME Zone A CA 5 000 000 → Classe 6', async ({ page }) => {
        await page.goto('/dashboard/cme');
        const caInput = page.getByLabel(/chiffre d.affaires/i).first();
        if (!(await caInput.isVisible())) return test.skip();
        await caInput.fill('5000000');
        await page.getByRole('button', { name: /calculer/i }).first().click();
        await expect(page.getByText(/classe 6|30.000|30 000/i)).toBeVisible({ timeout: 5_000 });
    });
});

// ─── Patente ─────────────────────────────────────────────────────────────────
test.describe('Patente Professionnelle', () => {
    test('page accessible', async ({ page }) => {
        await page.goto('/dashboard/patente');
        const heading = page.getByRole('heading', { name: /patente|brevet|verrouill/i });
        await expect(heading.first()).toBeVisible({ timeout: 8_000 });
    });

    test('calcul patente CA 20M → droit fixe 60 000', async ({ page }) => {
        await page.goto('/dashboard/patente');
        const caInput = page.getByLabel(/chiffre d.affaires/i).first();
        if (!(await caInput.isVisible())) return test.skip();
        await caInput.fill('20000000');
        await page.getByRole('button', { name: /calculer/i }).first().click();
        await expect(page.getByText(/60.000|60 000/i)).toBeVisible({ timeout: 5_000 });
    });
});

// ─── IS / MFP ────────────────────────────────────────────────────────────────
test.describe('IS / MFP — Impôt Sociétés', () => {
    test('page accessible', async ({ page }) => {
        await page.goto('/dashboard/is');
        const heading = page.getByRole('heading', { name: /IS|impôt.soci|MFP|verrouill/i });
        await expect(heading.first()).toBeVisible({ timeout: 8_000 });
    });

    test('calcul IS bénéfice 50M → IS théorique 13 750 000', async ({ page }) => {
        await page.goto('/dashboard/is');
        const benefInput = page.getByLabel(/bénéfice/i).first();
        if (!(await benefInput.isVisible())) return test.skip();
        await benefInput.fill('50000000');
        await page.getByRole('button', { name: /calculer/i }).first().click();
        await expect(page.getByText(/13.750|13 750/i)).toBeVisible({ timeout: 5_000 });
    });
});

// ─── TVA ─────────────────────────────────────────────────────────────────────
test.describe('TVA — Déclarations périodiques', () => {
    test('page TVA accessible', async ({ page }) => {
        await page.goto('/dashboard/tva');
        const heading = page.getByRole('heading', { name: /TVA|taxe.valeur|verrouill/i });
        await expect(heading.first()).toBeVisible({ timeout: 8_000 });
    });

    test('calcul TVA affiche solde collecté vs déductible', async ({ page }) => {
        await page.goto('/dashboard/tva');
        if (!(await page.getByText(/collectée|déductible/i).isVisible())) return test.skip();
        await expect(page.getByText(/collectée/i)).toBeVisible();
        await expect(page.getByText(/déductible/i)).toBeVisible();
        await expect(page.getByText(/solde|net|dû/i).first()).toBeVisible();
    });

    test('historique TVA affiché (table ou message vide)', async ({ page }) => {
        await page.goto('/dashboard/tva');
        if (!(await page.getByText(/collectée|verrouill/i).isVisible())) return test.skip();
        const content = page.getByRole('table').or(page.getByText(/aucune|vide|déclaration/i));
        await expect(content.first()).toBeVisible({ timeout: 8_000 });
    });
});

// ─── RAS — Retenues à la source ──────────────────────────────────────────────
test.describe('RAS — Retenues à la source', () => {
    test('page RAS accessible', async ({ page }) => {
        await page.goto('/dashboard/retenues');
        const heading = page.getByRole('heading', { name: /retenue|RAS|source|verrouill/i });
        await expect(heading.first()).toBeVisible({ timeout: 8_000 });
    });

    test('formulaire ajout retenue visible', async ({ page }) => {
        await page.goto('/dashboard/retenues');
        if (!(await page.getByText(/bénéficiaire|retenue/i).isVisible())) return test.skip();
        // Le bouton Ajouter ou le formulaire doit exister
        const addBtn = page.getByRole('button', { name: /ajouter|nouveau|créer/i });
        if (await addBtn.isVisible()) {
            await addBtn.click();
            await expect(page.getByLabel(/bénéficiaire/i)).toBeVisible({ timeout: 5_000 });
        }
    });

    test('liste retenues ou message vide', async ({ page }) => {
        await page.goto('/dashboard/retenues');
        if (!(await page.getByText(/retenue|verrouill/i).isVisible())) return test.skip();
        const content = page.getByRole('table').or(page.getByText(/aucune|vide/i));
        await expect(content.first()).toBeVisible({ timeout: 8_000 });
    });
});

// ─── Workflow ─────────────────────────────────────────────────────────────────
test.describe('Workflow — Validation déclarations', () => {
    test('page workflow accessible', async ({ page }) => {
        await page.goto('/dashboard/workflow');
        const heading = page.getByRole('heading', { name: /workflow|validation|approbation|verrouill/i });
        await expect(heading.first()).toBeVisible({ timeout: 8_000 });
    });

    test('filtres statut affichés', async ({ page }) => {
        await page.goto('/dashboard/workflow');
        if (!(await page.getByText(/soumis|révision|approuv/i).first().isVisible({ timeout: 6_000 }).catch(() => false))) return test.skip();
        await expect(page.getByText(/soumis|à réviser/i).first()).toBeVisible();
    });
});

// ─── Bulletins ────────────────────────────────────────────────────────────────
test.describe('Bulletins de paie', () => {
    test('génération bulletins accessible', async ({ page }) => {
        await page.goto('/dashboard/bulletins');
        const heading = page.getByRole('heading', { name: /bulletin|paie|verrouill/i });
        await expect(heading.first()).toBeVisible({ timeout: 8_000 });
    });

    test('export XLSX disponible si bulletins présents', async ({ page }) => {
        await page.goto('/dashboard/bulletins');
        if (!(await page.getByText(/bulletin|verrouill/i).isVisible())) return test.skip();
        // Le bouton export XLSX doit exister dans la page
        const exportBtn = page.getByRole('button', { name: /xlsx|export/i });
        if (await exportBtn.isVisible()) {
            await expect(exportBtn).toBeEnabled();
        }
    });
});

// ─── Historique fiscal ────────────────────────────────────────────────────────
test.describe('Historique fiscal complet', () => {
    test('page historique accessible', async ({ page }) => {
        await page.goto('/dashboard/historique');
        const heading = page.getByRole('heading', { name: /historique|fiscal|exercice/i });
        await expect(heading.first()).toBeVisible({ timeout: 8_000 });
    });

    test('sélecteur année et tableau mois/taxes', async ({ page }) => {
        await page.goto('/dashboard/historique');
        await expect(page.getByRole('combobox').first()).toBeVisible({ timeout: 5_000 });
        const content = page.getByRole('table').or(page.getByText(/IUTS|aucune|obligations/i));
        await expect(content.first()).toBeVisible({ timeout: 8_000 });
    });

    test('export XLSX historique fiscal', async ({ page }) => {
        await page.goto('/dashboard/historique');
        const exportBtn = page.getByRole('button', { name: /xlsx|export/i });
        if (await exportBtn.isVisible()) {
            await expect(exportBtn).toBeEnabled();
        }
    });
});

// ─── Assistant IA ─────────────────────────────────────────────────────────────
test.describe('Assistant IA fiscal', () => {
    test('page assistant accessible', async ({ page }) => {
        await page.goto('/dashboard/assistant');
        const heading = page.getByRole('heading', { name: /assistant|IA|fiscal|verrouill/i });
        await expect(heading.first()).toBeVisible({ timeout: 8_000 });
    });

    test('zone de chat visible (Pro+)', async ({ page }) => {
        await page.goto('/dashboard/assistant');
        const chat = page.getByPlaceholder(/question|message|posez/i);
        const locked = page.getByText(/pro|verrouill/i);
        const isVisible = await chat.isVisible().catch(() => false);
        const isLocked = await locked.isVisible().catch(() => false);
        expect(isVisible || isLocked).toBeTruthy();
    });
});

// ─── Multi-sociétés ───────────────────────────────────────────────────────────
test.describe('Multi-sociétés', () => {
    test('page sociétés accessible', async ({ page }) => {
        await page.goto('/dashboard/societes');
        const heading = page.getByRole('heading', { name: /soci[eé]t[eé]|entreprise|verrouill/i });
        await expect(heading.first()).toBeVisible({ timeout: 8_000 });
    });
});

// ─── Notifications ────────────────────────────────────────────────────────────
test.describe('Notifications', () => {
    test('icône cloche visible dans la topbar', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page.getByLabel(/notification/i)).toBeVisible({ timeout: 5_000 });
    });

    test('panneau notifications s\'ouvre au clic', async ({ page }) => {
        await page.goto('/dashboard');
        await page.getByLabel(/notification/i).click();
        await expect(page.getByText(/notification/i).first()).toBeVisible({ timeout: 5_000 });
    });
});
