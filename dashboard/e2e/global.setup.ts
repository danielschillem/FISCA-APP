import { test as setup, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const authFile = 'e2e/.auth/user.json'

/**
 * Global setup: log in once and persist the storageState so all
 * subsequent tests start already authenticated.
 */
setup('authenticate', async ({ page, baseURL }) => {
    const email = process.env.E2E_EMAIL ?? 'test@fisca.app'
    const password = process.env.E2E_PASSWORD ?? 'TestPass123!'

    await page.goto('/login')
    await expect(page).toHaveTitle(/FISCA/i)

    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })

    // Persist auth state (localStorage token is saved automatically)
    fs.mkdirSync(path.dirname(authFile), { recursive: true })
    await page.context().storageState({ path: authFile })
})
