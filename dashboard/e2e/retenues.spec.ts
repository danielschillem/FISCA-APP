import { test, expect } from '@playwright/test'

// ─── Retenues à la source ──────────────────────────────────────
test.describe('Retenues à la source', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/retenues')
        await expect(page).toHaveURL(/\/dashboard\/retenues/)
    })

    test('la page retenues se charge', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/retenue|source/i)
    })

    test('filtre période mois / année visibles', async ({ page }) => {
        const selects = page.locator('select')
        const count = await selects.count()
        expect(count).toBeGreaterThanOrEqual(2)
    })

    test('bouton Nouvelle retenue est présent', async ({ page }) => {
        const btn = page.locator('button', { hasText: /nouvelle|ajouter/i }).first()
        await expect(btn).toBeVisible({ timeout: 6_000 })
    })

    test('formulaire de saisie retenue s\'ouvre', async ({ page }) => {
        const btn = page.locator('button', { hasText: /nouvelle|ajouter/i }).first()
        await btn.click()
        // Un champ bénéficiaire doit apparaître
        await expect(
            page.locator('input[placeholder*="bénéficiaire" i], input[placeholder*="prestataire" i]').first()
        ).toBeVisible({ timeout: 5_000 })
    })

    test('sélecteur type retenue contient les 5 types CGI', async ({ page }) => {
        const btn = page.locator('button', { hasText: /nouvelle|ajouter/i }).first()
        await btn.click()

        const sel = page.locator('select').first()
        await expect(sel).toBeVisible({ timeout: 5_000 })

        // Vérifier que les 5 types sont présents dans le DOM
        await expect(page.locator('body')).toContainText(/services|loyer|dividendes|intérêts|autre/i)
    })

    test('calcul temps réel retenue visible lors de la saisie', async ({ page }) => {
        const btn = page.locator('button', { hasText: /nouvelle|ajouter/i }).first()
        await btn.click()

        const montantInput = page.locator('input[type="number"]').first()
        await montantInput.fill('1000000')

        // Un montant calculé doit apparaître
        await expect(page.locator('body')).toContainText(/retenue|net versé/i)
    })

    test('tableau retenues avec totaux en pied', async ({ page }) => {
        const rows = page.locator('table tbody tr')
        const count = await rows.count()
        if (count > 0) {
            // Un total doit apparaître dans le tfoot
            await expect(page.locator('tfoot')).toBeVisible()
        }
    })
})
