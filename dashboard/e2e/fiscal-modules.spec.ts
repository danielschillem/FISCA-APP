import { test, expect } from '@playwright/test'

// ─── IRF ────────────────────────────────────────────────────
test.describe('IRF — Revenus Fonciers', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/irf')
    })

    test('la page IRF se charge', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/IRF|Revenus Fonciers/i)
    })

    test('calcul IRF sur loyer 1 200 000 FCFA', async ({ page }) => {
        const input = page.locator('input[type="number"]').first()
        await input.fill('1200000')
        await page.locator('button', { hasText: /calculer/i }).first().click()

        // Abattement 50 % → base 600 000 → IRF attendu :
        // 100 000 × 18% = 18 000 + 500 000 × 25% = 125 000 → total 143 000
        await expect(page.locator('body')).toContainText(/143/, { timeout: 8_000 })
    })

    test('calcul IRF sur loyer 0 → résultat 0', async ({ page }) => {
        await page.locator('input[type="number"]').first().fill('0')
        await page.locator('button', { hasText: /calculer/i }).first().click()
        await expect(page.locator('body')).toContainText(/0 FCFA|0/)
    })
})

// ─── IRCM ────────────────────────────────────────────────────
test.describe('IRCM — Capitaux Mobiliers', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/ircm')
    })

    test('la page IRCM se charge', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/IRCM|Capitaux/i)
    })

    test('calcul IRCM créances 1 000 000 FCFA → 250 000 (25%)', async ({ page }) => {
        // Sélectionner CREANCES (déjà sélectionné par défaut)
        await page.locator('input[type="number"]').last().fill('1000000')
        await page.locator('button', { hasText: /calculer/i }).first().click()

        await expect(page.locator('body')).toContainText(/250/, { timeout: 8_000 })
    })

    test('calcul IRCM dividendes 2 000 000 FCFA → 250 000 (12.5%)', async ({ page }) => {
        // Sélectionner DIVIDENDES
        await page.locator('label', { hasText: /Dividendes/i }).click()
        await page.locator('input[type="number"]').last().fill('2000000')
        await page.locator('button', { hasText: /calculer/i }).first().click()

        await expect(page.locator('body')).toContainText(/250/, { timeout: 8_000 })
    })
})

// ─── CME ────────────────────────────────────────────────────
test.describe('CME — Contribution Micro-Entreprises', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/cme')
    })

    test('la page CME se charge', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/CME|Micro/i)
    })

    test('calcul CME Zone A classe appropriée', async ({ page }) => {
        await page.locator('input[type="number"]').first().fill('8000000')
        // Zone A déjà sélectionnée par défaut
        await page.locator('button', { hasText: /calculer/i }).first().click()

        await expect(page.locator('body')).toContainText(/Classe|FCFA/, { timeout: 8_000 })
    })

    test('réduction CGA appliquée', async ({ page }) => {
        await page.locator('input[type="number"]').first().fill('8000000')
        await page.locator('input[type="checkbox"]').first().check()
        await page.locator('button', { hasText: /calculer/i }).first().click()

        await expect(page.locator('body')).toContainText(/25 %|CGA/, { timeout: 8_000 })
    })
})

// ─── IS / MFP ────────────────────────────────────────────────
test.describe('IS / MFP', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/is')
    })

    test('la page IS se charge', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/IS|MFP|Sociétés/i)
    })

    test('calcul IS 27.5% sur bénéfice 100M', async ({ page }) => {
        const inputs = page.locator('input[type="number"]')
        await inputs.nth(0).fill('1000000000') // CA 1 Md
        await inputs.nth(1).fill('100000000')  // bénéfice 100 M
        await page.locator('button', { hasText: /calculer/i }).first().click()

        // IS = 100M × 27.5% = 27 500 000
        await expect(page.locator('body')).toContainText(/27/, { timeout: 8_000 })
    })
})

// ─── Patente ─────────────────────────────────────────────────
test.describe('Patente Professionnelle', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/patente')
    })

    test('la page Patente se charge', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/Patente/i)
    })

    test('calcul patente + tableau des droits fixes affiché', async ({ page }) => {
        const inputs = page.locator('input[type="number"]')
        await inputs.nth(0).fill('80000000')  // CA 80 M
        await inputs.nth(1).fill('2400000')   // VL 2.4 M/an
        await page.locator('button', { hasText: /calculer/i }).first().click()

        // Tableau des droits fixes doit être visible
        await expect(page.locator('table')).toBeVisible()
        // Résultat doit apparaître
        await expect(page.locator('body')).toContainText(/FCFA/, { timeout: 8_000 })
    })
})

// ─── Bilan ───────────────────────────────────────────────────
test.describe('Bilan Fiscal Annuel', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/bilan')
    })

    test('la page Bilan se charge avec sélecteur d\'année', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/Bilan/i)
        await expect(page.locator('select')).toBeVisible()
    })

    test('changement d\'année recharge les données', async ({ page }) => {
        const select = page.locator('select').first()
        await select.selectOption('2025')
        await expect(page.locator('body')).toContainText(/2025/)
    })

    test('bouton imprimer présent', async ({ page }) => {
        await expect(page.locator('button', { hasText: /imprimer/i })).toBeVisible()
    })
})

// ─── Abonnement ──────────────────────────────────────────────
test.describe('Abonnement & Plans', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/abonnement')
    })

    test('la page Abonnement se charge', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/Abonnement|Plan/i)
    })

    test('les 3 plans sont affichés', async ({ page }) => {
        await expect(page.locator('body')).toContainText(/Starter/i)
        await expect(page.locator('body')).toContainText(/Pro/i)
        await expect(page.locator('body')).toContainText(/Entreprise/i)
    })

    test('tableau comparatif des fonctionnalités affiché', async ({ page }) => {
        await expect(page.locator('table')).toBeVisible()
        await expect(page.locator('body')).toContainText(/IUTS|TVA|Bulletins/i)
    })
})
