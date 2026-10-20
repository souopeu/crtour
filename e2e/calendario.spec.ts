import { expect, test, type Page } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day (UTC-3)

async function cadastrar(page: Page, rotulo: string) {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill(`Pessoa ${rotulo}`)
  await page.getByLabel('Nome da agência').fill(`Agência ${rotulo}`)
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
}

test('calendar: departures, balances due and birthdays in the month, filters and links (R78–R81)', async ({ page }) => {
  const dia = iso(5)
  const mes = dia.slice(0, 7)
  await cadastrar(page, 'calendario')

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza')
  await page.getByLabel('Aniversário').fill(`1990-${dia.slice(5)}`)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Souza' })).toBeVisible()

  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Lisboa clássica')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Lisboa clássica', level: 1 })).toBeVisible()
  await page.getByLabel('Data da saída').fill(dia)
  await page.getByLabel('Vagas (capacidade)').fill('10')
  await page.getByLabel('Preço por pessoa (R$)').fill('1.000,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  const [a, m, d] = dia.split('-')
  await page.getByRole('link', { name: new RegExp(`${d}/${m}/${a}`) }).click()
  await expect(page.getByRole('heading', { name: `Saída de ${d}/${m}/${a}` })).toBeVisible()
  const urlSaida = page.url()

  await page.getByLabel(/Buscar cliente/).fill('ana')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: /Ana Souza/ }).click()
  await page.getByLabel('Número de pessoas').fill('2')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: 'Ana Souza' }).getByRole('link', { name: 'Pagamentos e detalhes' }).click()
  await page.getByLabel('Vencimento do saldo').fill(dia)
  await page.getByRole('button', { name: 'Salvar vencimento' }).click()
  await expect(page.getByText('Vencimento salvo.')).toBeVisible()
  const urlReserva = page.url()

  // The menu reaches the calendar; an invalid month falls back to the current one
  await page.goto('/calendario?mes=2030-13')
  await expect(page.getByRole('heading', { name: 'Calendário', level: 1 })).toBeVisible()
  await page.goto(`/calendario?mes=${mes}`)
  const grade = page.getByRole('table', { name: /Calendário de/ })
  await expect(grade.getByRole('link', { name: /Saída: Lisboa clássica, 2\/10 vagas, aberta/ })).toBeVisible()
  await expect(grade.getByRole('link', { name: /Saldo: Ana Souza, R\$\s2\.000,00/ })).toBeVisible()
  await expect(grade.getByRole('link', { name: /Aniversário: Ana Souza/ })).toBeVisible()

  // Chips hide and show a type, keeping the month
  await page.getByRole('link', { name: 'Saldos a vencer', exact: false }).click()
  await expect(page).toHaveURL(new RegExp(`mes=${mes}&sem=saldo`))
  await expect(grade.getByRole('link', { name: /Saldo:/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Saldos a vencer', exact: false }).click()
  await expect(grade.getByRole('link', { name: /Saldo:/ })).toHaveCount(1)

  // Items open their record; month navigation keeps working
  await grade.getByRole('link', { name: /Saldo: Ana Souza/ }).click()
  await expect(page).toHaveURL(urlReserva)
  await page.goto(`/calendario?mes=${mes}`)
  await grade.getByRole('link', { name: /Saída: Lisboa clássica/ }).click()
  await expect(page).toHaveURL(urlSaida)
  await page.goto(`/calendario?mes=${mes}`)
  await page.getByRole('link', { name: 'Próximo mês' }).click()
  await expect(page).not.toHaveURL(new RegExp(`mes=${mes}`))
  await page.getByRole('link', { name: 'Hoje', exact: true }).last().click()
  await expect(page.getByRole('table', { name: /Calendário de/ })).toBeVisible()

  // Phone: agenda list instead of the grid, no horizontal page scroll
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/calendario?mes=${mes}`)
  const agenda = page.getByRole('list', { name: 'Agenda do mês' })
  await expect(agenda.getByRole('link', { name: /Saída: Lisboa clássica/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
