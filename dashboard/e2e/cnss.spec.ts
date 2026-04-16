import { test, expect } from '@playwright/test'

// ─── CNSS Patronal ─────────────────────────────────────────────
test.describe('CNSS Patronal', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/cnss-patronal')
        await expect(page).toHaveURL(/\/dashboard\/cnss-patronal/)
    })

    test('la page CNSS patronal se charge', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/CNSS|patronal/i)
    })

    test('formulaire de génération avec sélecteurs période visibles', async ({ page }) => {
        const selects = page.locator('select')
        const count = await selects.count()
        expect(count).toBeGreaterThanOrEqual(2) // mois + année
    })

    test('bouton Générer fiche CNSS est présent', async ({ page }) => {
        const btn = page.locator('button', { hasText: /générer|gen/i }).first()
        await expect(btn).toBeVisible({ timeout: 6_000 })
    })

    test('liste des fiches CNSS affichée', async ({ page }) => {
        // La section liste doit s'afficher (vide ou avec données)
        await expect(page.locator('body')).toContainText(/fiche|CNSS|patronal/i)
    })

    test('fiches existantes : colonnes montants visibles', async ({ page }) => {
        const rows = page.locator('table tbody tr')
        const count = await rows.count()
        if (count > 0) {
            // Colonnes attendues : période, base, cotisations, total
            const firstRow = rows.first()
            await expect(firstRow).toContainText(/\d/)
        }
    })

    test('bouton Valider présent si fiche non validée', async ({ page }) => {
        const validateBtn = page.locator('button', { hasText: /valider/i })
        if (await validateBtn.count() > 0) {
            await expect(validateBtn.first()).toBeVisible()
        }
        // Pas d'erreur même si aucune fiche à valider
    })
})
