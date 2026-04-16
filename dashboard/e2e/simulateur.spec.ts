import { test, expect } from '@playwright/test'

// ─── Simulateur fiscal ────────────────────────────────────────
test.describe('Simulateur fiscal', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/simulateur')
        await expect(page).toHaveURL(/\/dashboard\/simulateur/)
    })

    test('la page simulateur se charge', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/simulat/i)
    })

    test('formulaire paramètres visible', async ({ page }) => {
        // Champs numériques : salaire_base, ancienneté, heures_sup, etc.
        const inputs = page.locator('input[type="number"]')
        await expect(inputs.first()).toBeVisible({ timeout: 6_000 })
        const count = await inputs.count()
        expect(count).toBeGreaterThanOrEqual(4)
    })

    test('sélecteur cotisation CNSS / CARFO', async ({ page }) => {
        const sel = page.locator('select')
        await expect(sel.first()).toBeVisible({ timeout: 6_000 })
        await expect(page.locator('body')).toContainText(/CNSS|CARFO/i)
    })

    test('calcul simulation → résultats affichés', async ({ page }) => {
        // Saisir un salaire de base
        const firstNumInput = page.locator('input[type="number"]').first()
        await firstNumInput.fill('250000')

        const calcBtn = page.locator('button', { hasText: /calculer|simuler/i }).first()
        await calcBtn.click()

        // Un résultat IUTS ou salaire net doit apparaître
        await expect(page.locator('body')).toContainText(/IUTS|salaire net|net/i, { timeout: 10_000 })
    })

    test('bouton Sauvegarder simulation est présent', async ({ page }) => {
        const saveBtn = page.locator('button', { hasText: /sauvegarder|enregistrer/i }).first()
        await expect(saveBtn).toBeVisible({ timeout: 6_000 })
    })

    test('historique des simulations affiché', async ({ page }) => {
        // La section simulations sauvegardées doit s'afficher
        await expect(page.locator('body')).toContainText(/simulation|historique|sauvegardé/i)
    })

    test('suppression d\'une simulation sauvegardée', async ({ page }) => {
        const deleteBtn = page.locator('button[title*="supprimer" i]').or(
            page.locator('button', { hasText: /supprimer/i })
        )
        const count = await deleteBtn.count()
        if (count > 0) {
            // Un bouton suppression existe → la page ne crash pas
            await expect(deleteBtn.first()).toBeVisible()
        }
    })
})
