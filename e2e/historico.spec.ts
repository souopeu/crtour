import { expect, test, type Page } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10)

async function cadastrar(page: Page, rotulo: string) {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill(`Pessoa ${rotulo}`)
  await page.getByLabel('Nome da agência').fill(`Agência ${rotulo}`)
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('link', { name: 'Passeios' })).toBeVisible()
}

async function novoCliente(page: Page, nome: string) {
  await page.goto('/clientes/novo')
  await expect(page.getByRole('heading', { name: 'Novo cliente' })).toBeVisible()
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
  return page.url()
}

async function novaSaida(page: Page, urlPasseio: string, data: string, vagas: string, preco: string) {
  await page.goto(urlPasseio)
  await page.getByLabel('Data da saída').fill(data)
  await page.getByLabel('Vagas (capacidade)').fill(vagas)
  await page.getByLabel('Preço por pessoa (R$)').fill(preco)
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await expect(page.getByText('Saída criada.')).toBeVisible()
}

async function abrirSaida(page: Page, urlPasseio: string, dataBr: string) {
  await page.goto(urlPasseio)
  await page.getByRole('link', { name: new RegExp(dataBr) }).click()
  await expect(page.getByRole('heading', { name: `Saída de ${dataBr}` })).toBeVisible()
  return page.url()
}

async function reservar(page: Page, urlSaida: string, busca: string, nome: string, pessoas: string) {
  await page.goto(urlSaida)
  await page.getByLabel(/Buscar cliente/).fill(busca)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: new RegExp(nome) }).click()
  await page.getByLabel('Número de pessoas').fill(pessoas)
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()
}

test('client sheet shows upcoming and past trips, balance owed, cancelled and companion trips', async ({ page }) => {
  await cadastrar(page, 'historico')
  const urlAna = await novoCliente(page, 'Ana Souza')
  const urlBeto = await novoCliente(page, 'Beto Lima')

  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Lisboa clássica')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Lisboa clássica', level: 1 })).toBeVisible()
  const urlPasseio = page.url()
  await novaSaida(page, urlPasseio, '2025-06-01', '10', '1.000,00') // past
  await novaSaida(page, urlPasseio, '2027-03-10', '10', '1.000,00') // upcoming
  await novaSaida(page, urlPasseio, '2027-09-20', '10', '1.000,00') // upcoming, will be cancelled

  const passada = await abrirSaida(page, urlPasseio, '01/06/2025')
  const futura = await abrirSaida(page, urlPasseio, '10/03/2027')
  const cancelada = await abrirSaida(page, urlPasseio, '20/09/2027')

  // Ana: past trip fully paid, upcoming trip with a down payment, a cancelled one
  await reservar(page, passada, 'ana', 'Ana Souza', '1')
  await page.getByRole('link', { name: 'Pagamentos e detalhes' }).click()
  await page.getByLabel('Valor (R$)', { exact: true }).fill('1.000,00')
  await page.getByLabel('Tipo').selectOption('saldo')
  await page.getByLabel('Data do pagamento').fill(iso(0))
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('Reserva quitada: não há saldo a receber.')).toBeVisible()

  await reservar(page, futura, 'ana', 'Ana Souza', '2')
  await page.getByRole('link', { name: 'Pagamentos e detalhes' }).click()
  await page.getByLabel('Valor (R$)', { exact: true }).fill('500,00')
  await page.getByLabel('Data do pagamento').fill(iso(0))
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('Pagamento registrado.')).toBeVisible()

  // A companion registered as a client on the upcoming trip
  await page.goto(futura)
  const reserva = page.getByRole('listitem').filter({ hasText: 'Acompanhantes' })
  await reserva.getByLabel(/Nome do acompanhante/).fill('João Souza')
  await reserva.getByRole('checkbox').check()
  await reserva.getByRole('button', { name: 'Adicionar acompanhante' }).click()
  await expect(reserva).toContainText('Todos os lugares desta reserva têm nome.')

  await reservar(page, cancelada, 'ana', 'Ana Souza', '1')
  const cartao = page.getByRole('listitem').filter({ hasText: 'Ana Souza' }).filter({ hasText: 'Pagamentos e detalhes' })
  await cartao.getByRole('button', { name: 'Cancelar reserva', exact: true }).click()
  await cartao.getByRole('button', { name: 'Cancelar reserva mesmo' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Ana Souza' }).filter({ hasText: 'Cancelada' })).toBeVisible()

  // Ana's sheet
  await page.goto(urlAna)
  const viagens = page.getByRole('region', { name: 'Viagens' })
  await expect(viagens).toContainText('Saldo em aberto: R$ 1.500,00') // only the active, unsettled trip
  const proximas = viagens.locator('div').filter({ has: page.getByRole('heading', { name: 'Próximas' }) }).first()
  await expect(proximas).toContainText('10/03/2027')
  await expect(proximas).toContainText('Pago R$ 500,00')
  await expect(proximas).toContainText('falta R$ 1.500,00')
  await expect(proximas).toContainText('20/09/2027')
  await expect(proximas).toContainText('Cancelada')
  // upcoming ones are in date order
  const datasProximas = await proximas.locator('li a span.text-sm.text-tinta-suave').allTextContents()
  expect(datasProximas.filter((t) => /^\d{2}\/\d{2}\/\d{4}$/.test(t))).toEqual(['10/03/2027', '20/09/2027'])
  const passadas = viagens.locator('div').filter({ has: page.getByRole('heading', { name: 'Já viajou' }) }).first()
  await expect(passadas).toContainText('01/06/2025')
  await expect(passadas).toContainText('quitada')

  // Opening a trip goes to its payments
  await proximas.getByRole('link', { name: /10\/03\/2027/ }).click()
  await expect(page.getByRole('heading', { name: /Reserva de Ana Souza/ })).toBeVisible()

  // The companion lead shows the trip as companion, with no money
  await page.goto('/?q=joao')
  await page.getByRole('link', { name: /João Souza/ }).click()
  const viagensJoao = page.getByRole('region', { name: 'Viagens' })
  await expect(viagensJoao).toContainText('Como acompanhante')
  await expect(viagensJoao).toContainText('Nenhum saldo em aberto.')
  await expect(viagensJoao).not.toContainText('Pago')

  // A client without trips
  await page.goto(urlBeto)
  await expect(page.getByRole('region', { name: 'Viagens' })).toContainText('Nenhuma viagem registrada para este cliente.')
})
