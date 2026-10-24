import { expect, test, type Page } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day (UTC-3)
const br = (data: string) => data.split('-').reverse().join('/')

async function cadastrar(page: Page) {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa reservas')
  await page.getByLabel('Nome da agência').fill('Agência reservas')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-reservas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
}

async function novoCliente(page: Page, nome: string) {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
}

async function saidaComReserva(page: Page, urlPasseio: string, data: string, cliente: string) {
  await page.goto(urlPasseio)
  await page.getByLabel('Data da saída').fill(data)
  await page.getByLabel('Vagas (capacidade)').fill('10')
  await page.getByLabel('Preço por pessoa (R$)').fill('100,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await page.getByRole('link', { name: new RegExp(br(data).replace(/\//g, '\\/')) }).click()
  await page.getByLabel(/Buscar cliente/).fill(cliente.split(' ')[0])
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: new RegExp(cliente) }).click()
  await page.getByLabel('Número de pessoas').fill('2')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()
}

// E9-0 (R133–R135): the Reservas list with the page header and the period card kept in the address.
test('Reservas list: header, period shortcuts, typed dates and tabs', async ({ page }) => {
  await cadastrar(page)
  await page.goto('/reservas')
  await expect(page.getByRole('heading', { name: 'Reservas', level: 1 })).toBeVisible()
  await expect(page.getByText('Nenhuma reserva neste período.')).toBeVisible()

  await novoCliente(page, 'Ana Hoje')
  await novoCliente(page, 'Bia Depois')
  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('City tour')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'City tour', level: 1 })).toBeVisible()
  const urlPasseio = page.url()
  await saidaComReserva(page, urlPasseio, iso(0), 'Ana Hoje')
  await saidaComReserva(page, urlPasseio, iso(40), 'Bia Depois')

  const atalhos = page.getByRole('navigation', { name: 'Atalhos de período' })
  const tabela = page.getByRole('table', { name: 'Reservas' })

  // Default: coming departures, both
  await page.goto('/reservas')
  await expect(atalhos.getByRole('link', { name: 'Próximas' })).toHaveAttribute('aria-current', 'page')
  await expect(tabela.getByRole('row', { name: /^Total/ })).toContainText('2 reservas')

  // Shortcut "Hoje" lives in the address and survives a reload
  await atalhos.getByRole('link', { name: 'Hoje' }).click()
  await expect(page).toHaveURL(/periodo=hoje/)
  await page.reload()
  await expect(atalhos.getByRole('link', { name: 'Hoje' })).toHaveAttribute('aria-current', 'page')
  await expect(tabela.getByRole('row', { name: /Ana Hoje/ })).toBeVisible()
  await expect(tabela.getByRole('row', { name: /Bia Depois/ })).toHaveCount(0)

  // Typed dates win over the shortcut
  await page.getByLabel('A partir de').fill(iso(30))
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page).toHaveURL(new RegExp(`de=${iso(30)}`))
  await expect(atalhos.locator('[aria-current]')).toHaveCount(0)
  await expect(tabela.getByRole('row', { name: /Bia Depois/ })).toBeVisible()
  await expect(tabela.getByRole('row', { name: /Ana Hoje/ })).toHaveCount(0)

  // Tabs keep the period; the menu marks Reservas on the list and on a reservation
  await page.getByRole('navigation', { name: 'Situação das reservas' }).getByRole('link', { name: 'Canceladas' }).click()
  await expect(page).toHaveURL(new RegExp(`de=${iso(30)}.*aba=canceladas|aba=canceladas.*de=${iso(30)}`))
  await expect(page.getByText('Nenhuma reserva cancelada neste período.')).toBeVisible()
  await page.goto('/reservas')
  await tabela.getByRole('link', { name: 'Ana Hoje' }).click()
  await expect(page).toHaveURL(/\/reservas\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Reservas' }).last()).toHaveAttribute('aria-current', 'page')
})
