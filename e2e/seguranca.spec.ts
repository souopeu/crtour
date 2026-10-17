import { expect, test } from '@playwright/test'

test('security headers are sent on pages and downloads', async ({ request }) => {
  for (const rota of ['/login', '/termos', '/importar/modelo']) {
    const r = await request.get(rota, { maxRedirects: 0 })
    const h = r.headers()
    expect(h['x-frame-options'], rota).toBe('DENY')
    expect(h['x-content-type-options'], rota).toBe('nosniff')
    expect(h['referrer-policy'], rota).toBe('strict-origin-when-cross-origin')
    expect(h['content-security-policy'], rota).toContain("frame-ancestors 'none'")
    expect(h['permissions-policy'], rota).toContain('camera=()')
    expect(h['strict-transport-security'], rota).toContain('max-age=')
  }
})

test('no secret-looking values are exposed to the browser', async ({ page }) => {
  await page.goto('/login')
  const html = await page.content()
  expect(html).not.toMatch(/service_role|sb_secret_|SUPABASE_SERVICE/i)
})

test('the app is installable as a PWA (Chrome installability check)', async ({ page }) => {
  await page.goto('/login')
  const cdp = await page.context().newCDPSession(page)
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
  // Playwright contexts are incognito, which Chrome always reports; every other criterion must pass.
  expect(installabilityErrors.filter((e) => e.errorId !== 'in-incognito')).toEqual([])

  const manifest = await (await page.request.get('/manifest.webmanifest')).json()
  expect(manifest.display).toBe('standalone')
  for (const icone of manifest.icons) {
    const r = await page.request.get(icone.src)
    expect(r.status(), icone.src).toBe(200)
    expect(r.headers()['content-type']).toContain('image/png')
  }
})
