import { test, expect } from '@playwright/test'

test.describe('Authentification', () => {
    test.use({ storageState: undefined }) // run without existing auth

    test('login → redirect vers dashboard', async ({ page }) => {
        const email = process.env.E2E_EMAIL ?? 'test@fisca.app'
        const password = process.env.E2E_PASSWORD ?? 'TestPass123!'

        await page.goto('/login')

        await expect(page.locator('h1, h2')).toContainText(/FISCA|Connexion/i)

        await page.fill('input[type="email"]', email)
        await page.fill('input[type="password"]', password)
        await page.click('button[type="submit"]')

        await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
        await expect(page).toHaveURL(/\/dashboard/)
    })

    test('login avec mauvais mot de passe → message d\'erreur', async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[type="email"]', 'wrong@fisca.app')
        await page.fill('input[type="password"]', 'mauvaismdp')
        await page.click('button[type="submit"]')

        // Should stay on login and show an error
        await expect(page).toHaveURL(/\/login/)
        await expect(page.locator('body')).toContainText(/invalide|incorrect|erreur/i)
    })

    test('page protégée redirige vers /login si non authentifié', async ({ page }) => {
        // Clear storage so we're logged out
        await page.context().clearCookies()
        await page.evaluate(() => localStorage.clear())

        await page.goto('/dashboard')
        await page.waitForURL(/\/login/, { timeout: 8_000 })
        await expect(page).toHaveURL(/\/login/)
    })

    test('mot de passe oublié → message anti-énumération affiché', async ({ page }) => {
        await page.goto('/forgot-password')
        await page.fill('input[type="email"]', 'quelquun@fisca.app')
        await page.click('button[type="submit"]')

        await expect(page.locator('body')).toContainText(/enregistré|email/i, { timeout: 8_000 })
    })
})
