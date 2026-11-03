import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3211',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run dev -- --port 3211',
    url: 'http://localhost:3211/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_PATH: './.data/e2e-test.sqlite',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'test-password',
      ADMIN_COOKIE_SECURE: 'false',
    },
  },
  globalSetup: './tests/e2e/global-setup.ts',
})
