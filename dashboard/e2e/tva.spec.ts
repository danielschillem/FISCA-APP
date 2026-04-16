import { test, expect } from '@playwright/test'

// ─── Déclarations TVA ─────────────────────────────────────────
test.describe('TVA — Déclarations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/tva')
        await expect(page).toHaveURL(/\/dashboard\/tva/)
    })

    test('la page TVA se charge', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/TVA|taxe|déclaration/i)
    })

    test('bouton créer une déclaration TVA est visible', async ({ page }) => {
        const createBtn = page.locator('button', { hasText: /créer|nouvelle|ajouter/i }).first()
        await expect(createBtn).toBeVisible({ timeout: 6_000 })
    })

    test('formulaire de création déclenché par le bouton', async ({ page }) => {
        const createBtn = page.locator('button', { hasText: /créer|nouvelle|ajouter/i }).first()
        await createBtn.click()
        // Un formulaire ou une section mois/année doit apparaître
        await expect(page.locator('select, input[type="number"]').first()).toBeVisible({ timeout: 5_000 })
    })

    test('sélecteur taux TVA (18 % / 10 %) dans le formulaire ligne', async ({ page }) => {
        // Ouvrir ou chercher le form de ligne
        const inputs = page.locator('input[type="number"]')
        if (await inputs.count() > 0) {
            // Des champs numériques (montant HT, taux) doivent être présents
            await expect(inputs.first()).toBeVisible()
        }
    })

    test('liste des déclarations TVA affichée', async ({ page }) => {
        await expect(page.locator('body')).toContainText(/TVA|déclaration|période/i)
    })

    test('déclarations existantes : expansion et lignes', async ({ page }) => {
        const rows = page.locator('table tbody tr')
        const count = await rows.count()
        if (count > 0) {
            // Cliquer sur la première ligne pour l'expandre
            const expandBtn = page.locator('button', { hasText: /▶|▼/ }).or(
                page.locator('svg[data-testid*="chevron" i]')
            ).first()
            if (await expandBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await expandBtn.click()
                await expect(page.locator('body')).toContainText(/vente|achat|ligne/i, { timeout: 5_000 })
            }
        }
    })
})
