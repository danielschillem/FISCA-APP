import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // Lance le serveur de dev automatiquement hors CI
    ...(process.env.CI
        ? {}
        : {
            webServer: {
                command: 'npm run dev',
                url: 'http://localhost:5173',
                reuseExistingServer: true,
                timeout: 120_000,
            },
        }),
});
