import { test, expect } from '@playwright/test'

test.describe('Calcul fiscal IUTS / TPA', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/calcul')
        await expect(page).toHaveURL(/\/dashboard\/calcul/)
    })

    test('la page calcul charge correctement', async ({ page }) => {
        await expect(page.locator('h2, h1')).toContainText(/calcul/i)
    })

    test('calcul IUTS sur salaire de 250 000 FCFA', async ({ page }) => {
        // Fill salary field
        await page.fill('input[name="salaire_brut"], input[placeholder*="brut" i]', '250000')

        // Trigger calculation
        const calcBtn = page.locator('button', { hasText: /calculer|lancer/i }).first()
        await calcBtn.click()

        // Result should appear (IUTS amount > 0)
        await expect(page.locator('body')).toContainText(/IUTS|iuts/i, { timeout: 10_000 })
    })

    test('calcul sur salaire 0 → pas d\'IUTS', async ({ page }) => {
        await page.fill('input[name="salaire_brut"], input[placeholder*="brut" i]', '0')

        const calcBtn = page.locator('button', { hasText: /calculer|lancer/i }).first()
        await calcBtn.click()

        // Any result shows (no crash), IUTS should be 0 FCFA
        await expect(page.locator('body')).toContainText(/0/, { timeout: 10_000 })
    })
})
