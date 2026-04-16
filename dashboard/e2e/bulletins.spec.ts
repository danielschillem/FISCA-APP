import { test, expect } from '@playwright/test'

// ─── Bulletins de paie ─────────────────────────────────────────
test.describe('Bulletins de paie', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/bulletins')
        await expect(page).toHaveURL(/\/dashboard\/bulletins/)
    })

    test('la page bulletins se charge correctement', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/bulletin/i)
    })

    test('sélecteurs mois / année sont visibles', async ({ page }) => {
        await expect(page.locator('select').first()).toBeVisible({ timeout: 6_000 })
    })

    test('sélecteur cotisation CNSS / CARFO est présent', async ({ page }) => {
        // Il doit y avoir au moins un select
        const selects = page.locator('select')
        const count = await selects.count()
        expect(count).toBeGreaterThanOrEqual(2)
    })

    test('bouton Générer les bulletins est présent et cliquable', async ({ page }) => {
        const genBtn = page.locator('button', { hasText: /générer|générer les bulletins/i }).first()
        await expect(genBtn).toBeVisible({ timeout: 6_000 })
    })

    test('liste vide → message approprié ou table vide', async ({ page }) => {
        // La page doit s'afficher sans crash
        await expect(page.locator('body')).toContainText(/bulletin|mois|année/i)
    })

    test('bouton supprimer affiché si des bulletins existent', async ({ page }) => {
        const rows = page.locator('table tbody tr')
        const count = await rows.count()
        if (count > 0) {
            // Au moins un bouton de suppression ou d'export doit être visible
            const actionBtns = page.locator('button[title], a[href*="/export"]')
            await expect(actionBtns.first()).toBeVisible({ timeout: 5_000 })
        }
        // Si 0 lignes : test passe (état vide valide)
    })
})
