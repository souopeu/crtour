import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Uses the installed Chrome (no browser download needed).
  use: { baseURL: 'http://localhost:3100', channel: 'chrome' },
  webServer: {
    command: 'npm run build && npx next start -p 3100',
    url: 'http://localhost:3100/login',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
