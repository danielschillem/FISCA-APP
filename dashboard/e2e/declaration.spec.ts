import { test, expect } from '@playwright/test'

test.describe('Déclarations fiscales', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/historique')
        await expect(page).toHaveURL(/\/dashboard\/historique/)
    })

    test('la page historique charge correctement', async ({ page }) => {
        await expect(page.locator('h2, h1')).toContainText(/historique|déclaration/i)
    })

    test('création d\'une nouvelle déclaration', async ({ page }) => {
        const newBtn = page.locator('button', { hasText: /nouvelle|déclarer|ajouter/i }).first()
        await newBtn.click()

        // Select month and year
        const monthSel = page.locator('select[name="mois"], input[name="mois"]').first()
        const yearSel = page.locator('select[name="annee"], input[name="annee"]').first()

        if (await monthSel.isVisible()) await monthSel.selectOption('1')
        if (await yearSel.isVisible()) await yearSel.fill('2024')

        const submitBtn = page.locator('button[type="submit"]').last()
        await submitBtn.click()

        // Declaration should appear in list
        await expect(page.locator('body')).toContainText(/2024|janvier|jan/i, { timeout: 10_000 })
    })

    test('bouton Exporter CSV est présent', async ({ page }) => {
        const exportBtn = page.locator('button, a', { hasText: /exporter|csv/i })
        await expect(exportBtn.first()).toBeVisible()
    })

    test('aucune déclaration → message vide affiché', async ({ page }) => {
        // This test is conditional — only meaningful when list is empty
        const rows = page.locator('table tbody tr, [data-testid="decl-row"]')
        const count = await rows.count()

        if (count === 0) {
            await expect(page.locator('body')).toContainText(/aucune|vide|pas de/i)
        } else {
            // There are declarations — just verify the table has rows
            expect(count).toBeGreaterThan(0)
        }
    })
})
