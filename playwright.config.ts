import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Uses the installed Chrome (no browser download needed).
  use: { baseURL: 'http://localhost:3100', channel: 'chrome' },
  webServer: {
    command: 'npm run build && npx next start -p 3100',
    url: 'http://localhost:3100/login',
    reuseExistingServer: true,
    // E-mailed links use a configured base URL in production builds.
    env: { NEXT_PUBLIC_SITE_URL: 'http://localhost:3100' },
    timeout: 180_000,
  },
})
