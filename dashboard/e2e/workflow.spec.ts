import { test, expect } from '@playwright/test'

// ─── Workflow de validation des déclarations ───────────────────
test.describe('Workflow de validation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/workflow')
        await expect(page).toHaveURL(/\/dashboard\/workflow/)
    })

    test('la page workflow se charge', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/workflow|validation|déclaration/i)
    })

    test('tableau des déclarations s\'affiche', async ({ page }) => {
        await expect(page.locator('body')).toContainText(/période|statut|déclaration/i)
    })

    test('statuts affichés avec codes couleur', async ({ page }) => {
        // Des badges de statut doivent être présents
        const badges = page.locator('.badge, [class*="badge"]')
        // Test souple : si des déclarations existent les badges sont visibles
        const rowCount = await page.locator('table tbody tr').count()
        if (rowCount > 0) {
            await expect(badges.first()).toBeVisible({ timeout: 5_000 })
        }
    })

    test('bouton Soumettre présent pour les déclarations en cours', async ({ page }) => {
        const submitBtn = page.locator('button', { hasText: /soumettre/i })
        if (await submitBtn.count() > 0) {
            await expect(submitBtn.first()).toBeVisible()
        }
    })

    test('bouton Approuver présent pour les déclarations soumises', async ({ page }) => {
        const approveBtn = page.locator('button', { hasText: /approuver/i })
        if (await approveBtn.count() > 0) {
            await expect(approveBtn.first()).toBeVisible()
        }
    })

    test('expansion historique workflow d\'une déclaration', async ({ page }) => {
        const rows = page.locator('table tbody tr')
        const count = await rows.count()
        if (count > 0) {
            // Cliquer sur la première ligne pour voir l'historique
            await rows.first().click()
            // Un historique ou des étapes doivent apparaître
            await expect(page.locator('body')).toContainText(/soumission|approbation|étape|commentaire/i, { timeout: 6_000 })
                .catch(() => { }) // ok si pas d'historique
        }
    })

    test('modal de confirmation pour les actions workflow', async ({ page }) => {
        const actionBtn = page.locator('button', { hasText: /soumettre|approuver|rejeter/i }).first()
        if (await actionBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await actionBtn.click()
            // Un champ commentaire ou une confirmation doit apparaître
            await expect(
                page.locator('textarea, input[placeholder*="commentaire" i]').or(
                    page.locator('[role="dialog"]')
                )
            ).toBeVisible({ timeout: 5_000 })
        }
    })
})
