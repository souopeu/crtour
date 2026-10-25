import { expect, test, type Page } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day (UTC-3)
const br = (data: string) => data.split('-').reverse().join('/')
const re = (texto: string) => new RegExp(texto.replace(/[/.]/g, '\\$&'))

async function novoCliente(page: Page, nome: string) {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
}

async function novoPasseio(page: Page, nome: string): Promise<string> {
  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill(nome)
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: nome, level: 1 })).toBeVisible()
  return page.url()
}

async function novaSaida(page: Page, urlPasseio: string, data: string, vagas: string, horario = '') {
  await page.goto(urlPasseio)
  await page.getByLabel('Data da saída').fill(data)
  if (horario) await page.getByLabel('Horário (opcional)').fill(horario)
  await page.getByLabel('Vagas (capacidade)').fill(vagas)
  await page.getByLabel('Preço por pessoa (R$)').fill('100,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await expect(page.getByText('Saída criada.')).toBeVisible()
}

async function reservar(page: Page, urlPasseio: string, data: string, cliente: string, pessoas: string) {
  await page.goto(urlPasseio)
  await page.getByRole('link', { name: re(br(data)) }).click()
  await page.getByLabel(/Buscar cliente/).fill(cliente.split(' ')[0])
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: new RegExp(cliente) }).click()
  await page.getByLabel('Número de pessoas').fill(pessoas)
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()
}

// E9-3 (R139–R140): the day's departures in time order, and moving a reservation within the same tour.
test('Saídas do dia and moving a reservation', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa dia')
  await page.getByLabel('Nome da agência').fill('Agência dia')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-dia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  const d1 = iso(3)
  const d2 = iso(5)
  await novoCliente(page, 'Ana Dia')
  await novoCliente(page, 'Bia Dia')
  const praia = await novoPasseio(page, 'Praia do sol')
  const serra = await novoPasseio(page, 'Serra azul')
  await novaSaida(page, praia, d1, '10', '09:00')
  await novaSaida(page, praia, d2, '2')
  await novaSaida(page, serra, d1, '5', '08:00')
  await reservar(page, praia, d1, 'Ana Dia', '2')
  await reservar(page, praia, d2, 'Bia Dia', '1')

  // The day: one card per departure, by time
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Saídas do dia' }).click()
  await expect(page.getByRole('heading', { name: 'Saídas do dia', level: 1 })).toBeVisible()
  await page.getByLabel('Data das saídas').fill(d1)
  await page.getByRole('button', { name: 'Ver' }).click()
  await expect(page).toHaveURL(new RegExp(`dia=${d1}`))
  const cartoes = page.getByRole('article')
  await expect(cartoes).toHaveCount(2)
  await expect(cartoes.nth(0)).toContainText('08:00')
  await expect(cartoes.nth(0)).toContainText('Serra azul')
  const praiaD1 = cartoes.filter({ hasText: 'Praia do sol' })
  await expect(praiaD1).toContainText('09:00')
  await expect(praiaD1).toContainText('2 / 10 lugares')
  await expect(praiaD1).toContainText('Ana Dia')
  await expect(praiaD1).toContainText('A definir')

  // Ana (2 people) has nowhere to go: the other departure has only 1 seat left
  await praiaD1.getByText('Mover para outra saída').click()
  await expect(praiaD1.getByText(/Não há outra saída aberta deste passeio/)).toBeVisible()

  // Bia moves from the reservation page to the day-1 departure
  await page.goto(`/operacao?dia=${d2}`)
  await page.getByRole('article').getByRole('link', { name: 'Bia Dia' }).click()
  await expect(page.getByRole('heading', { name: /Reserva de/ })).toBeVisible()
  // Next keeps the previous page hidden in the DOM: act on what is visible
  await page.getByText('Mover para outra saída').filter({ visible: true }).click()
  await page.getByLabel('Saída de destino').filter({ visible: true }).selectOption({ label: `${br(d1)} · 09:00 · 8 lugares livres` })
  await page.getByRole('button', { name: 'Mover', exact: true }).filter({ visible: true }).click()
  await expect(page.getByText('Reserva movida.')).toBeVisible()
  await expect(page.getByRole('link', { name: re(`Praia do sol · saída de ${br(d1)}`) })).toBeVisible()

  // The day now shows her there, and the old departure is empty; the arrows move one day
  await page.goto(`/operacao?dia=${d1}`)
  await expect(page.getByRole('article').filter({ hasText: 'Praia do sol' })).toContainText('3 / 10 lugares')
  await expect(page.getByRole('article').filter({ hasText: 'Praia do sol' })).toContainText('Bia Dia')
  await page.getByRole('link', { name: 'Próximo dia' }).click()
  await expect(page).toHaveURL(new RegExp(`dia=${iso(4)}`))
  await expect(page.getByText('Nenhuma saída neste dia.')).toBeVisible()
  await page.goto(`/operacao?dia=${d2}`)
  await expect(page.getByRole('article')).toContainText('Nenhuma reserva nesta saída.')
})
