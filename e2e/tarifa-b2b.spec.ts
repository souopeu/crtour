import { expect, test } from '@playwright/test'

// E11-4 (R162–R163): the owner marks a partner agency, sets the B2B price and sells B2B; lists filter by rate.
test('B2B rate: partner, B2B price, B2B sale and the rate filter', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa b2b')
  await page.getByLabel('Nome da agência').fill('Agência b2b')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-b2b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  // A partner agency (client marked as partner)
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Agência Parceira Sul')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Agência Parceira Sul' })).toBeVisible()
  await page.getByRole('button', { name: 'Marcar como agência parceira (B2B)' }).click()
  await expect(page.getByText('Agência parceira (B2B)', { exact: true })).toBeVisible()

  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Praia B2B')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Praia B2B', level: 1 })).toBeVisible()
  await page.getByLabel('Data da saída').fill('2030-05-10')
  await page.getByLabel('Vagas (capacidade)').fill('10')
  await page.getByLabel('Preço por pessoa (R$)').fill('100,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await page.getByRole('link', { name: /10\/05\/2030/ }).click()
  await expect(page.getByRole('heading', { name: 'Saída de 10/05/2030' })).toBeVisible()

  // B2B price on the departure (owner only)
  await page.getByLabel('Preço B2B por pessoa (R$)').fill('70,00')
  await page.getByRole('button', { name: 'Salvar preço B2B' }).click()
  await expect(page.getByText('Preço B2B salvo.')).toBeVisible()

  // Sell B2B to the partner: 2 × 70,00
  await page.getByLabel(/Buscar cliente/).fill('parceira')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: /Agência Parceira Sul/ }).click()
  await page.getByLabel('Número de pessoas').fill('2')
  await expect(page.getByText('Total: R$ 200,00')).toBeVisible()
  await page.getByLabel(/B2B \(agência parceira\)/).check()
  await expect(page.getByText('Total: R$ 140,00')).toBeVisible()
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Agência Parceira Sul' })).toContainText('R$ 140,00')

  // Reservas filters by rate
  await page.goto('/reservas?periodo=todas')
  await page.getByRole('navigation', { name: 'Tarifa' }).getByRole('link', { name: 'B2B' }).click()
  await expect(page.getByRole('table', { name: 'Reservas' })).toContainText('Agência Parceira Sul')
  await page.getByRole('navigation', { name: 'Tarifa' }).getByRole('link', { name: 'Balcão' }).click()
  await expect(page.getByText('Agência Parceira Sul')).toHaveCount(0)
})
