import { defineConfig } from '@playwright/test'
import { execSync } from 'node:child_process'

// The LOCAL service key, so the e2e server can do its server-only writes (WhatsApp send, spec 19 R105).
// Read from `supabase status` and only when the stack is on localhost; empty otherwise.
function chaveServicoLocal(): string {
  try {
    const env = execSync('supabase status -o env', { encoding: 'utf8' })
    const url = /^API_URL="?([^"\n]+)"?$/m.exec(env)?.[1] ?? ''
    if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) return ''
    return /^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m.exec(env)?.[1] ?? ''
  } catch {
    return ''
  }
}

export default defineConfig({
  testDir: './e2e',
  // Long user journeys (20-40 s each) share the machine with a production build and parallel workers.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  // Uses the installed Chrome (no browser download needed).
  use: { baseURL: 'http://localhost:3100', channel: 'chrome' },
  webServer: {
    command: 'bash scripts/e2e-servidor.sh', // builds and serves on 3100, one run per checkout (lock)
    url: 'http://localhost:3100/login',
    reuseExistingServer: true,
    // E-mailed links use a configured base URL in production builds.
    // WHATSAPP_FALSO_LOCAL: the inbox sends through a fake provider (only works against the local database).
    // WHATSAPP_PROVEDOR=meta with test-only secrets: e2e posts notices signed like Meta's (spec 21).
    // CRON_SECRET: test-only secret so e2e can tick the reminders clock (R132).
    // NEXT_PUBLIC_VAPID_PUBLIC_KEY only (test key, its private half was discarded): the device toggle shows (R131)
    // but the clock never pushes to a real push service during tests.
    env: {
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3100', WHATSAPP_FALSO_LOCAL: '1', SUPABASE_SERVICE_ROLE_KEY: chaveServicoLocal(),
      WHATSAPP_PROVEDOR: 'meta', WHATSAPP_META_APP_SECRET: 'segredo-e2e-local', WHATSAPP_META_VERIFY_TOKEN: 'token-e2e-local',
      CRON_SECRET: 'relogio-e2e-local-segredo',
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'BERZrWZPxK6YwsPKz7UWWeGevVlM3tYw7Y4IA06Wfo9TNYziV673GbAE93XYa4HJsEijoSk-aS8l5RNF-Xwjp9g',
    },
    timeout: 180_000,
  },
})
