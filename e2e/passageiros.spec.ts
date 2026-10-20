import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

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

test('companions, printable passenger list, CSV and access control', async ({ page, browser, request }) => {
  await cadastrar(page, 'passag')

  await page.goto('/clientes/novo')
  await expect(page.getByRole('heading', { name: 'Novo cliente' })).toBeVisible()
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza')
  await page.getByRole('textbox', { name: /WhatsApp/ }).fill('(11) 99999-0001')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Souza' })).toBeVisible()

  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Lisboa clássica')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Lisboa clássica', level: 1 })).toBeVisible()
  await page.getByLabel('Data da saída').fill('2027-03-10')
  await page.getByLabel('Vagas (capacidade)').fill('10')
  await page.getByLabel('Preço por pessoa (R$)').fill('1.000,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await page.getByRole('link', { name: /10\/03\/2027/ }).click()
  await expect(page.getByRole('heading', { name: 'Saída de 10/03/2027' })).toBeVisible()
  const urlSaida = page.url()

  await page.getByLabel(/Buscar cliente/).fill('ana')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: /Ana Souza/ }).click()
  await page.getByLabel('Número de pessoas').fill('3')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()

  const reserva = page.getByRole('listitem').filter({ hasText: 'Acompanhantes' })
  await expect(reserva).toContainText('2 lugares sem nome')

  // Validation
  await reserva.getByRole('button', { name: 'Adicionar acompanhante' }).click()
  await expect(page.getByText('Digite o nome do acompanhante.')).toBeVisible()
  await reserva.getByLabel(/Nome do acompanhante/).fill('Fulano')
  await reserva.getByLabel('WhatsApp (opcional)').fill('123')
  await reserva.getByRole('button', { name: 'Adicionar acompanhante' }).click()
  await expect(page.getByText('WhatsApp inválido')).toBeVisible()

  // First companion
  await reserva.getByLabel(/Nome do acompanhante/).fill('Maria Silva')
  await reserva.getByLabel('WhatsApp (opcional)').fill('(11) 98888-0000')
  await reserva.getByRole('button', { name: 'Adicionar acompanhante' }).click()
  await expect(reserva).toContainText('Maria Silva · (11) 98888-0000')
  await expect(reserva).toContainText('1 lugar sem nome')

  // Second one, also registered as a client (new lead without marketing consent)
  await reserva.getByLabel(/Nome do acompanhante/).fill('João Souza')
  await reserva.getByRole('checkbox').check()
  await reserva.getByRole('button', { name: 'Adicionar acompanhante' }).click()
  await expect(reserva).toContainText('Todos os lugares desta reserva têm nome.')

  await page.goto('/?q=joao')
  await expect(page.getByRole('row', { name: /João Souza/ })).toContainText('Consentimento não informado')

  // Remove and refill
  await page.goto(urlSaida)
  await reserva.getByRole('button', { name: 'Remover Maria Silva' }).click()
  await expect(reserva).toContainText('1 lugar sem nome')
  await expect(reserva).not.toContainText('Maria Silva')
  await reserva.getByLabel(/Nome do acompanhante/).fill('Maria Silva')
  await reserva.getByLabel('WhatsApp (opcional)').fill('(11) 98888-0000')
  await reserva.getByRole('button', { name: 'Adicionar acompanhante' }).click()
  await expect(reserva).toContainText('Todos os lugares desta reserva têm nome.')

  // Make one place unnamed again to see the placeholder on the list
  await reserva.getByRole('button', { name: 'Remover João Souza' }).click()
  await expect(reserva).toContainText('1 lugar sem nome')

  // Printable list
  await page.getByRole('link', { name: /Lista de passageiros/ }).click()
  await expect(page.getByRole('heading', { name: 'Lista de passageiros' })).toBeVisible()
  await expect(page.getByText('3 passageiros de 10 vagas · 1 nome a informar')).toBeVisible()
  const linhas = page.locator('tbody tr')
  await expect(linhas).toHaveCount(3)
  await expect(linhas.nth(0)).toContainText('Ana Souza')
  await expect(linhas.nth(0)).toContainText('Responsável')
  await expect(linhas.nth(0)).toContainText('(11) 99999-0001')
  await expect(linhas.nth(1)).toContainText('Maria Silva')
  await expect(linhas.nth(2)).toContainText('(nome a informar)')

  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('link', { name: 'Configurações' })).toBeHidden() // app header and buttons are not printed
  await expect(page.getByRole('button', { name: 'Imprimir' })).toBeHidden()
  await expect(page.getByRole('table')).toBeVisible()
  await page.emulateMedia({ media: 'screen' })

  // CSV for the guide
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: /Baixar em planilha/ }).click()
  const arquivo = await download
  expect(arquivo.suggestedFilename()).toBe('passageiros-2027-03-10.csv')
  const csv = readFileSync((await arquivo.path())!, 'utf8')
  expect(csv).toContain('Nº;Nome;Tipo;WhatsApp;Reserva')
  expect(csv).toContain('1;Ana Souza;Responsável;(11) 99999-0001;Ana Souza')
  expect(csv).toContain('3;(nome a informar);Acompanhante;;Ana Souza')

  // Companions are part of the data export too
  const acompanhantesCsv = await (await page.request.get('/exportar?tipo=acompanhantes')).text()
  expect(acompanhantesCsv).toContain('Responsável;Passeio;Data da saída;Acompanhante;WhatsApp;Cadastrado como cliente')
  expect(acompanhantesCsv).toContain('Ana Souza;Lisboa clássica;10/03/2027;Maria Silva;(11) 98888-0000;Não')

  // Access control
  const anonimo = await request.get(`${test.info().project.use.baseURL}${new URL(urlSaida).pathname}/passageiros/csv`, { maxRedirects: 0 })
  expect([307, 308, 401]).toContain(anonimo.status())
  const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const outra = await contexto.newPage()
  await cadastrar(outra, 'outra-passag')
  await outra.goto(`${new URL(urlSaida).pathname}/passageiros`)
  await expect(outra.getByText('could not be found')).toBeVisible()
  const csvOutra = await outra.request.get(`${new URL(urlSaida).pathname}/passageiros/csv`)
  expect(csvOutra.status()).toBe(404)
  await contexto.close()
})
