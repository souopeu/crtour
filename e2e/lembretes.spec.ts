import { expect, test } from '@playwright/test'

const SEGREDO = 'relogio-e2e-local-segredo' // same as CRON_SECRET in playwright.config.ts
// Brazil wall-clock time (UTC-3) as datetime-local, `minutos` from now.
const agoraBr = (minutos: number) => new Date(Date.now() + minutos * 60_000 - 3 * 3_600_000).toISOString().slice(0, 16)

test('reminders: the clock needs its secret, an activity due now reaches the bell and the notices page (R128–R130, R132)', async ({ page, request }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa lembrete')
  await page.getByLabel('Nome da agência').fill('Agência lembrete')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-lembrete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Ana Lembrete')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Lembrete' })).toBeVisible()
  const urlAna = page.url()
  const secao = page.getByRole('region', { name: 'Atividades' })
  await secao.getByLabel('O que fazer ou o que foi feito').fill('Ligar para a Ana')
  await secao.getByLabel('Data e hora').fill(agoraBr(-10))
  await secao.getByLabel('Situação').selectOption('pendente')
  await secao.getByRole('button', { name: 'Salvar atividade' }).click()
  await expect(page.getByText('Atividade agendada.')).toBeVisible()

  // R132: without the secret the clock refuses; with it, it creates the reminders
  expect((await request.get('/api/lembretes/relogio')).status()).toBe(401)
  expect((await request.get('/api/lembretes/relogio', { headers: { authorization: 'Bearer errado-errado-errado' } })).status()).toBe(401)
  const tique = await request.get('/api/lembretes/relogio', { headers: { authorization: `Bearer ${SEGREDO}` } })
  expect(tique.status()).toBe(200)
  expect((await tique.json()).criados).toBeGreaterThanOrEqual(1)
  // (no duplicate on a second tick is checked in pgTAP: here other tests' agencies may get reminders at the same time)
  expect((await request.get('/api/lembretes/relogio', { headers: { authorization: `Bearer ${SEGREDO}` } })).status()).toBe(200)

  // R130: the bell shows the count and the reminder, which leads to the client
  await page.goto('/hoje')
  const sino = page.getByRole('banner').getByLabel('Notificações, 1 nova')
  await expect(sino).toBeVisible()
  await sino.click()
  const lista = page.getByRole('list', { name: 'Últimas notificações' })
  await expect(lista).toContainText('Agora: Ligar para a Ana')
  await lista.getByRole('link', { name: /Agora: Ligar para a Ana/ }).click()
  await expect(page).toHaveURL(urlAna)

  // The notices page lists it; marking it read clears the bell
  await page.goto('/avisos')
  await expect(page.locator('p', { hasText: 'Agora: Ligar para a Ana' })).toBeVisible() // the closed bell holds the same text
  await page.getByRole('button', { name: 'Marcar como lido' }).click()
  await expect(page.getByText('Tudo lido.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('banner').getByLabel('Notificações', { exact: true })).toBeVisible()
})
