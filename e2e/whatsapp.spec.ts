import { expect, test } from '@playwright/test'

test('WhatsApp: without a configured provider the notice route does not exist and no screen changes (R73)', async ({ request, page }) => {
  const r = await request.post('/api/whatsapp/aviso/meta', { data: [{ tipo: 'mensagem' }], maxRedirects: 0 })
  expect(r.status()).toBe(404)
  expect((await request.post('/api/whatsapp/avisoX', { maxRedirects: 0 })).status()).toBe(307)

  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa whats')
  await page.getByLabel('Nome da agência').fill('Agência whats')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-whats-${Date.now()}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: /Conversas|Caixa de entrada/ })).toHaveCount(0)
})
