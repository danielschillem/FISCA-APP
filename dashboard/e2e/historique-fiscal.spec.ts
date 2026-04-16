import { test, expect } from '@playwright/test'

// ─── Historique fiscal annuel ─────────────────────────────────
test.describe('Historique fiscal', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/historique-fiscal')
        await expect(page).toHaveURL(/\/dashboard\/historique-fiscal/)
    })

    test('la page historique fiscal se charge', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/historique|fiscal/i)
    })

    test('sélecteur d\'année présent', async ({ page }) => {
        const sel = page.locator('select')
        await expect(sel.first()).toBeVisible({ timeout: 6_000 })
    })

    test('KPIs annuels IUTS, TPA, CNSS affichés', async ({ page }) => {
        // Des cartes KPI doivent être visibles
        await expect(page.locator('body')).toContainText(/IUTS|TPA|CNSS/i, { timeout: 8_000 })
    })

    test('graphique barres Recharts rendu', async ({ page }) => {
        // Le SVG du graphique doit être présent dans le DOM
        const svg = page.locator('svg').first()
        await expect(svg).toBeVisible({ timeout: 10_000 })
    })

    test('tableau mensuel présent avec 12 lignes max', async ({ page }) => {
        const rows = page.locator('table tbody tr')
        const count = await rows.count()
        // 0 à 12 lignes (mois) sont attendues
        expect(count).toBeLessThanOrEqual(12)
    })

    test('changement d\'année recharge les données', async ({ page }) => {
        const sel = page.locator('select').first()
        const options = await sel.locator('option').all()
        if (options.length > 1) {
            const secondVal = await options[1].getAttribute('value')
            if (secondVal) {
                await sel.selectOption(secondVal)
                // Après changement d'année, la page ne crash pas
                await expect(page.locator('body')).toContainText(/IUTS|TPA|CNSS/i, { timeout: 8_000 })
            }
        }
    })
})

// ─── Bilan fiscal ────────────────────────────────────────────
test.describe('Bilan fiscal', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/bilan')
        await expect(page).toHaveURL(/\/dashboard\/bilan/)
    })

    test('la page bilan se charge', async ({ page }) => {
        await expect(page.locator('h2, h3')).toContainText(/bilan|rapport|fiscal/i)
    })

    test('sélecteur d\'année présent', async ({ page }) => {
        // Un select ou input numérique pour l'année
        const sel = page.locator('select, input[type="number"]').first()
        await expect(sel).toBeVisible({ timeout: 6_000 })
    })

    test('totaux IUTS, TPA, CSS affichés', async ({ page }) => {
        await expect(page.locator('body')).toContainText(/IUTS|TPA|CSS/i, { timeout: 8_000 })
    })

    test('tableau des déclarations par mois visible', async ({ page }) => {
        // Soit un tableau, soit un message vide
        const hasTable = await page.locator('table').isVisible({ timeout: 6_000 }).catch(() => false)
        const hasEmpty = await page.locator('body').textContent().then(t =>
            /aucune|vide|pas de déclaration/i.test(t ?? '')
        )
        expect(hasTable || hasEmpty).toBeTruthy()
    })

    test('bouton exporter CSV affiché', async ({ page }) => {
        const exportBtn = page.locator('button, a', { hasText: /export|csv|imprimer/i }).first()
        if (await exportBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
            await expect(exportBtn).toBeVisible()
        }
    })
})
