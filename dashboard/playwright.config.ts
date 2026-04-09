import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E — FISCA Dashboard
 * Run: npm run e2e            (headless)
 *      npm run e2e:ui          (interactive)
 *
 * Required env vars:
 *   BASE_URL          (default: http://localhost:3000)
 *   E2E_EMAIL         (default: test@fisca.app)
 *   E2E_PASSWORD      (default: TestPass123!)
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,         // sequential: shared auth state
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['list'],
    ],
    use: {
        baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        // Reuse auth cookie/storage across tests via storageState
        storageState: 'e2e/.auth/user.json',
    },
    projects: [
        // Setup project: login once and save storage state
        {
            name: 'setup',
            testMatch: /global\.setup\.ts/,
            use: { storageState: undefined },
        },
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['setup'],
        },
    ],
    webServer: process.env.CI
        ? undefined
        : {
            command: 'npm run dev',
            url: 'http://localhost:3000',
            reuseExistingServer: true,
            timeout: 60_000,
        },
})
