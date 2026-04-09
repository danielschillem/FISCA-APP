import { test, expect } from '@playwright/test'

test.describe('Saisie des employés', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/saisie')
        await expect(page).toHaveURL(/\/dashboard\/saisie/)
    })

    test('la page de saisie charge correctement', async ({ page }) => {
        await expect(page.locator('h2, h1')).toContainText(/saisie/i)
    })

    test('ajout d\'un employé valide', async ({ page }) => {
        // Open add-employee form (button or modal trigger)
        const addBtn = page.locator('button', { hasText: /ajouter|nouvel/i }).first()
        await addBtn.click()

        // Fill in employee fields
        await page.fill('input[placeholder*="nom" i], input[name="nom"]', 'Traoré Kofi')
        await page.fill('input[placeholder*="poste" i], input[name="poste"]', 'Développeur')
        await page.fill('input[placeholder*="brut" i], input[name="salaire_brut"]', '250000')

        // Submit
        const submitBtn = page.locator('button[type="submit"]').last()
        await submitBtn.click()

        // Employee should appear in the list
        await expect(page.locator('body')).toContainText('Traoré', { timeout: 10_000 })
    })

    test('erreur si nom vide', async ({ page }) => {
        const addBtn = page.locator('button', { hasText: /ajouter|nouvel/i }).first()
        await addBtn.click()

        // Leave nom empty, fill salary
        await page.fill('input[placeholder*="brut" i], input[name="salaire_brut"]', '100000')

        const submitBtn = page.locator('button[type="submit"]').last()
        await submitBtn.click()

        // Should see validation error or stay on form
        const formVisible = await page.locator('input[name="nom"], input[placeholder*="nom" i]').isVisible()
        expect(formVisible).toBe(true)
    })
})
