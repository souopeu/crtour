import { expect, test } from '@playwright/test'

// E11-5 (R164–R165): an excursion of several days, its itinerary, the calendar and Saídas do dia.
test('excursions: days, itinerary, calendar and the day in progress', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa excursões')
  await page.getByLabel('Nome da agência').fill('Agência excursões')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-excursoes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  // An excursion needs 2 to 30 days
  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Serra gaúcha')
  await page.getByLabel('Tipo').selectOption('excursao')
  await page.getByLabel('Número de dias').fill('1')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByText('Uma excursão tem de 2 a 30 dias.')).toBeVisible()
  await page.getByLabel('Número de dias').fill('3')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Serra gaúcha', level: 1 })).toBeVisible()

  // Itinerary
  await expect(page.getByRole('heading', { name: 'Roteiro (3 dias)' })).toBeVisible()
  await page.getByLabel('Título do dia 1').fill('Gramado')
  await page.getByLabel('O que acontece no dia 1').fill('Chegada e Lago Negro')
  await page.getByLabel('Título do dia 2').fill('Canela')
  await page.getByRole('button', { name: 'Salvar roteiro' }).click()
  await expect(page.getByText('Roteiro salvo.')).toBeVisible()
  await expect(page.getByLabel('Título do dia 2')).toHaveValue('Canela')

  await page.getByLabel('Data da saída').fill('2030-11-07')
  await page.getByLabel('Vagas (capacidade)').fill('40')
  await page.getByLabel('Preço por pessoa (R$)').fill('900,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await expect(page.getByText('Saída criada.')).toBeVisible()

  // The calendar fills the three days
  await page.goto('/calendario?mes=2030-11')
  const agenda = page.getByRole('table', { name: /Calendário de/ })
  await expect(agenda.getByText(/Saída: Serra gaúcha,/)).toBeVisible()
  await expect(agenda.getByText(/Saída: Serra gaúcha \(dia 2 de 3\)/)).toBeVisible()
  await expect(agenda.getByText(/Saída: Serra gaúcha \(dia 3 de 3\)/)).toBeVisible()

  // Saídas do dia: the start shows when it returns; the next day shows it in progress
  await page.goto('/operacao?dia=2030-11-07')
  await expect(page.getByText('Excursão de 3 dias · volta em 09/11/2030')).toBeVisible()
  await page.goto('/operacao?dia=2030-11-08')
  await expect(page.getByText('Excursão em andamento · dia 2 de 3')).toBeVisible()
  await page.goto('/operacao?dia=2030-11-10')
  await expect(page.getByText(/Serra gaúcha/)).toHaveCount(0)
})
