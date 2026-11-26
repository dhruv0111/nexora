import { defineConfig, devices } from '@playwright/test';
if (
  process.env.TEST_DATABASE_URL &&
  !new URL(process.env.TEST_DATABASE_URL).pathname.includes('nexora_phase1')
)
  throw new Error(
    'Browser fixtures require an isolated nexora_phase1 database.',
  );
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'wide',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'small-mobile',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 375, height: 812 },
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run start -- --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: process.env.TEST_DATABASE_URL
      ? {
          DATABASE_URL: process.env.TEST_DATABASE_URL,
          LEAD_FORM_SECRET: 'isolated-inquiry-secret-for-tests-only-0000',
          INQUIRY_ORIGIN: 'http://127.0.0.1:3100',
          NEXTAUTH_URL: 'http://127.0.0.1:3100',
          NEXTAUTH_SECRET: 'isolated-e2e-secret-for-tests-only-0000',
          GITHUB_ID: 'test-not-a-real-client',
          GITHUB_SECRET: 'test-not-a-real-secret',
        }
      : undefined,
  },
});
