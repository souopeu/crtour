import { expect, test } from '@playwright/test'

// E11-1 (R155–R156): create departures in batch, rerun without duplicates, change the price of the future ones.
test('departures in batch: preview, create, skip existing, change price', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa lote')
  await page.getByLabel('Nome da agência').fill('Agência lote')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-lote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Praia em lote')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Praia em lote', level: 1 })).toBeVisible()

  // 2030-01-07 is a Monday: Mon–Fri (marked by default) in one week, at two times = 10 departures
  await page.getByText('Criar várias saídas').click()
  const lote = page.locator('details')
  await lote.getByLabel('Primeira data').fill('2030-01-07')
  await lote.getByLabel('Última data').fill('2030-01-13')
  await lote.getByLabel('Horários (opcional)').fill('08:00, 14:00')
  await lote.getByLabel('Vagas (capacidade)').fill('10')
  await lote.getByLabel('Preço por pessoa (R$)').fill('50,00')
  await expect(lote.getByText('Serão criadas 10 saídas.')).toBeVisible()
  await lote.getByRole('button', { name: 'Criar saídas' }).click()
  await expect(lote.getByText('10 saídas criadas.')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Marcar a saída/ })).toHaveCount(10)

  // The same batch again creates nothing
  await lote.getByLabel('Primeira data').fill('2030-01-07')
  await lote.getByLabel('Última data').fill('2030-01-13')
  await lote.getByLabel('Horários (opcional)').fill('08:00, 14:00')
  await lote.getByLabel('Vagas (capacidade)').fill('10')
  await lote.getByLabel('Preço por pessoa (R$)').fill('50,00')
  await expect(lote.getByText('Serão criadas 0 saídas (10 já existem e serão puladas).')).toBeVisible()
  await lote.getByRole('button', { name: 'Criar saídas' }).click()
  await expect(lote.getByText('0 saídas criadas. 10 já existiam e foram puladas.')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Marcar a saída/ })).toHaveCount(10)

  // New price for all future departures
  await page.getByRole('button', { name: 'Marcar todas as futuras' }).click()
  await expect(page.getByText('10 saídas marcadas')).toBeVisible()
  await page.getByLabel('Novo preço por pessoa (R$)').fill('60,00')
  await page.getByRole('button', { name: 'Aplicar às marcadas' }).click()
  await expect(page.getByText('10 saídas alteradas.')).toBeVisible()
  await expect(page.getByText(/R\$\s60,00 por pessoa/)).toHaveCount(10)
})
