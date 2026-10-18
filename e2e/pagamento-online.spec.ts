import { expect, test } from '@playwright/test'

test('online payment: without a configured provider the notice route does not exist and nothing changes', async ({ request, page }) => {
  // Reachable without a session (no redirect to login), but there is no provider: 404
  const r = await request.post('/api/pagamentos/aviso/asaas', { data: { id: 'x', valor: 100 }, maxRedirects: 0 })
  expect(r.status()).toBe(404)
  expect((await request.get('/api/pagamentos/aviso/asaas', { maxRedirects: 0 })).status()).toBe(405)

  // Other API paths still require login
  const outra = await request.post('/api/pagamentos/avisoX', { maxRedirects: 0 })
  expect(outra.status()).toBe(307)

  // No online-payment controls anywhere for a normal agency
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa online')
  await page.getByLabel('Nome da agência').fill('Agência online')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-online-${Date.now()}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
  await page.goto('/configuracoes')
  await expect(page.getByText(/cobrança online|pagamento online/i)).toHaveCount(0)
})
