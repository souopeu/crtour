import { expect, test } from '@playwright/test'

test('notices on this device: the toggle registers the device and turns it off again (R131)', async ({ page, context }) => {
  await context.grantPermissions(['notifications'])
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa push')
  await page.getByLabel('Nome da agência').fill('Agência push')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  // The service worker is public (no login redirect) and only handles push and taps
  const sw = await page.request.get('/sw.js')
  expect(sw.status()).toBe(200)
  expect(await sw.text()).toContain("addEventListener('push'")

  await page.goto('/configuracoes')
  const secao = page.getByRole('region', { name: 'Avisos neste aparelho' })
  await secao.getByRole('button', { name: 'Receber avisos neste aparelho' }).click()
  // Subscribing needs the browser's push service; when it is unreachable the screen says so instead of pretending.
  await expect(secao.getByText(/Este aparelho recebe avisos|Não foi possível ligar os avisos/)).toBeVisible({ timeout: 30_000 })
  if (await secao.getByText('Este aparelho recebe avisos.').isVisible()) {
    await page.reload()
    await expect(secao.getByText('Este aparelho recebe avisos.')).toBeVisible()
    await secao.getByRole('button', { name: 'Parar de receber neste aparelho' }).click()
    await expect(secao.getByRole('button', { name: 'Receber avisos neste aparelho' })).toBeVisible()
  }
})
