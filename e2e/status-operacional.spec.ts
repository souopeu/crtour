import { expect, test, type Page } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day (UTC-3)
const br = (data: string) => data.split('-').reverse().join('/')

async function cadastrar(page: Page) {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa status')
  await page.getByLabel('Nome da agência').fill('Agência status')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-status-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
}

// E9-1 (R136): status moves forward in one click, goes back only after confirming, and shows in Reservas, Hoje and Calendário.
test('operational status of a reservation', async ({ page }) => {
  await cadastrar(page)
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Rita Status')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Rita Status' })).toBeVisible()

  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Barco ao pôr do sol')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Barco ao pôr do sol', level: 1 })).toBeVisible()
  const dia = iso(2)
  await page.getByLabel('Data da saída').fill(dia)
  await page.getByLabel('Vagas (capacidade)').fill('8')
  await page.getByLabel('Preço por pessoa (R$)').fill('150,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await page.getByRole('link', { name: new RegExp(br(dia).replace(/\//g, '\\/')) }).click()
  await page.getByLabel(/Buscar cliente/).fill('rita')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: /Rita Status/ }).click()
  await page.getByLabel('Número de pessoas').fill('2')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()

  // Hoje lists it as still to organise
  await page.goto('/hoje?ver=todas')
  const organizar = page.getByRole('region', { name: /Reservas para organizar/ })
  await expect(organizar).toContainText('Rita Status')
  await expect(organizar).toContainText('A definir')
  await organizar.getByRole('link', { name: 'Rita Status' }).click()

  // Forward in one click, even skipping a step
  const status = page.getByRole('region', { name: 'Status da operação' })
  await expect(status.getByRole('button', { name: 'A definir' })).toHaveAttribute('aria-current', 'step')
  await status.getByRole('button', { name: 'Pronta' }).click()
  await expect(status.getByText('Status: Pronta.')).toBeVisible()
  await expect(status.getByRole('button', { name: 'Pronta' })).toHaveAttribute('aria-current', 'step')

  // Back only after confirming; cancelling keeps it
  await status.getByRole('button', { name: 'Em organização' }).click()
  await expect(status.getByText('Voltar de Pronta para Em organização?')).toBeVisible()
  await status.getByRole('button', { name: 'Cancelar' }).click()
  await expect(status.getByRole('button', { name: 'Pronta' })).toHaveAttribute('aria-current', 'step')
  await status.getByRole('button', { name: 'Em organização' }).click()
  await status.getByRole('button', { name: 'Voltar mesmo' }).click()
  await expect(status.getByText('Status: Em organização.')).toBeVisible()
  await expect(status.getByRole('button', { name: 'Em organização' })).toHaveAttribute('aria-current', 'step')

  // Reservas: column and filter
  await page.goto('/reservas?status=pronta')
  await expect(page.getByText('Nenhuma reserva com este status neste período.')).toBeVisible()
  await page.getByRole('navigation', { name: 'Status da operação' }).getByRole('link', { name: 'A organizar' }).click()
  await expect(page.getByRole('table', { name: 'Reservas' }).getByRole('row', { name: /Rita Status/ })).toContainText('Em organização')

  // Calendário: the departure says one reservation is left to organise
  await page.goto(`/calendario?mes=${dia.slice(0, 7)}`)
  await expect(page.getByRole('link', { name: /Saída: Barco ao pôr do sol, 2\/8 vagas · 1 a organizar/ }).first()).toBeVisible()
})
