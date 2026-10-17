import { expect, test, type Page } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day (UTC-3)

async function cadastrar(page: Page, rotulo: string) {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill(`Pessoa ${rotulo}`)
  await page.getByLabel('Nome da agência').fill(`Agência ${rotulo}`)
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-${rotulo}-${Date.now()}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
}

async function novoCliente(page: Page, nome: string, whatsapp: string, consentimento: string) {
  await page.goto('/clientes/novo')
  await expect(page.getByRole('heading', { name: 'Novo cliente' })).toBeVisible()
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  await page.getByRole('textbox', { name: /WhatsApp/ }).fill(whatsapp)
  await page.getByLabel('Consentimento').selectOption(consentimento)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
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

test('payments, balance, refunds, due dates and the billing list', async ({ page, browser }) => {
  await cadastrar(page, 'pagtos')
  await novoCliente(page, 'Ana Souza', '(11) 99999-0001', 'aceitou')
  await novoCliente(page, 'Beto Lima', '(21) 98888-0002', 'nao_informado')
  await novoCliente(page, 'Caio Reis', '(31) 97777-0003', 'pediu_saida')

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

  await reservar(page, urlSaida, 'ana', 'Ana Souza', '2') // R$ 2.000,00
  await reservar(page, urlSaida, 'beto', 'Beto Lima', '1') // R$ 1.000,00
  await reservar(page, urlSaida, 'caio', 'Caio Reis', '1') // R$ 1.000,00

  // Ana's reservation page
  await page.goto(urlSaida)
  await page.getByRole('listitem').filter({ hasText: 'Ana Souza' }).getByRole('link', { name: 'Pagamentos e detalhes' }).click()
  await expect(page.getByRole('heading', { name: /Reserva de Ana Souza/ })).toBeVisible()
  const urlAna = page.url()
  const resumo = page.getByRole('region', { name: 'Resumo financeiro' })
  await expect(resumo).toContainText('R$ 2.000,00')
  await expect(resumo).toContainText('Falta pagar')

  // Validation, over-payment, future date
  await page.getByLabel('Valor (R$)', { exact: true }).fill('0')
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('Digite um valor maior que zero')).toBeVisible()
  await page.getByLabel('Valor (R$)', { exact: true }).fill('9.000,00')
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('O valor excede o saldo da reserva')).toBeVisible()
  await page.getByLabel('Valor (R$)', { exact: true }).fill('500,00')
  await page.getByLabel('Data do pagamento').fill(iso(1))
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('A data do pagamento não pode estar no futuro.')).toBeVisible()

  // Down payment
  await page.getByLabel('Valor (R$)', { exact: true }).fill('500,00')
  await page.getByLabel('Data do pagamento').fill(iso(0))
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('Pagamento registrado.')).toBeVisible()
  await expect(resumo).toContainText('R$ 500,00')
  await expect(resumo).toContainText('R$ 1.500,00')
  const lista = page.getByRole('list').filter({ hasText: 'Sinal' })
  await expect(lista).toContainText('R$ 500,00')
  await expect(lista).toContainText('Pix')

  // Refund keeps the history
  await page.getByRole('button', { name: 'Estornar pagamento' }).click()
  await page.getByRole('button', { name: 'Voltar' }).click()
  await page.getByRole('button', { name: 'Estornar pagamento' }).click()
  await page.getByRole('button', { name: 'Estornar mesmo' }).click()
  await expect(lista).toContainText('Estorno −R$ 500,00')
  await expect(lista).toContainText('Estornado')
  await expect(page.getByRole('button', { name: 'Estornar pagamento' })).toHaveCount(0) // refund of a refund / twice: no button
  await expect(resumo).toContainText('Falta pagar')

  // Total can be lowered (discount) but not below what was paid
  await page.getByLabel('Valor (R$)', { exact: true }).fill('600,00')
  await page.getByLabel('Data do pagamento').fill(iso(0))
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('Pagamento registrado.')).toBeVisible()
  await page.getByLabel('Valor total da reserva (R$)').fill('400,00')
  await page.getByRole('button', { name: 'Salvar valor total' }).click()
  await expect(page.getByText('o total ficaria abaixo do que já foi pago')).toBeVisible()
  await page.getByLabel('Valor total da reserva (R$)').fill('1.800,00')
  await page.getByRole('button', { name: 'Salvar valor total' }).click()
  await expect(page.getByText('Valor total atualizado.')).toBeVisible()
  await expect(resumo).toContainText('R$ 1.800,00')
  await expect(resumo).toContainText('R$ 1.200,00') // 1.800 - 600

  // Due dates: Ana overdue, Beto in 3 days, Caio none
  await page.getByLabel('Vencimento do saldo').fill(iso(-10))
  await page.getByRole('button', { name: 'Salvar vencimento' }).click()
  await expect(page.getByText('Vencimento salvo.')).toBeVisible()
  await expect(resumo).toContainText('Vencido há 10 dias')
  await expect(resumo).toContainText('Vencida')

  await page.goto(urlSaida)
  await page.getByRole('listitem').filter({ hasText: 'Beto Lima' }).getByRole('link', { name: 'Pagamentos e detalhes' }).click()
  await expect(page.getByRole('heading', { name: /Reserva de Beto Lima/ })).toBeVisible()
  const urlBeto = page.url()
  await page.getByLabel('Vencimento do saldo').fill(iso(3))
  await page.getByRole('button', { name: 'Salvar vencimento' }).click()
  await expect(page.getByText('Vencimento salvo.')).toBeVisible()

  // Billing list and filters
  await page.getByRole('link', { name: 'Cobranças' }).click()
  await expect(page.getByRole('heading', { name: 'Cobranças' })).toBeVisible()
  await expect(page.getByText('3 reservas')).toBeVisible()
  const itens = page.locator('ul > li').filter({ hasText: 'Ver reserva e pagamentos' })
  await expect(itens.nth(0)).toContainText('Ana Souza') // most urgent first
  await expect(itens.nth(0)).toContainText('Vencida há 10 dias')
  await expect(itens.nth(1)).toContainText('Beto Lima')
  await expect(itens.nth(2)).toContainText('Caio Reis')

  await page.getByRole('link', { name: 'Vencidas', exact: true }).click()
  await expect(itens).toHaveCount(1)
  await expect(itens.first()).toContainText('Ana Souza')
  await page.getByRole('link', { name: 'Vencem em 7 dias' }).click()
  await expect(itens).toHaveCount(1)
  await expect(itens.first()).toContainText('Beto Lima')
  await page.getByRole('link', { name: 'Sem vencimento' }).click()
  await expect(itens).toHaveCount(1)
  await expect(itens.first()).toContainText('Caio Reis')
  await page.getByRole('link', { name: 'Todas', exact: true }).click()

  // WhatsApp billing rules
  const ana = itens.filter({ hasText: 'Ana Souza' })
  const hrefAna = await ana.getByRole('link', { name: 'Cobrar no WhatsApp' }).getAttribute('href')
  expect(hrefAna).toContain('https://wa.me/5511999990001?text=')
  expect(decodeURIComponent(hrefAna!)).toContain('saldo de R$ 1.200,00')
  expect(decodeURIComponent(hrefAna!)).toContain('Lisboa clássica')
  await expect(itens.filter({ hasText: 'Beto Lima' }).getByRole('link', { name: 'Cobrar no WhatsApp' })).toBeVisible()
  await expect(itens.filter({ hasText: 'Beto Lima' })).toContainText('Consentimento de mensagens não informado')
  await expect(itens.filter({ hasText: 'Caio Reis' }).getByRole('link', { name: 'Cobrar no WhatsApp' })).toHaveCount(0)
  await expect(itens.filter({ hasText: 'Caio Reis' })).toContainText('Pediu para não receber mensagens.')

  // Settling removes Ana from the list
  await page.goto(urlAna)
  await page.getByLabel('Valor (R$)', { exact: true }).fill('1.200,00')
  await page.getByLabel('Tipo').selectOption('saldo')
  await page.getByLabel('Data do pagamento').fill(iso(0))
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('Reserva quitada: não há saldo a receber.')).toBeVisible()
  await expect(resumo).toContainText('Quitada')
  await page.goto('/cobrancas')
  await expect(page.getByText('Ana Souza')).toHaveCount(0)

  // A cancelled reservation takes no payments and leaves the billing list
  await page.goto(urlSaida)
  const beto = page.getByRole('listitem').filter({ hasText: 'Beto Lima' }).filter({ hasText: 'Pagamentos e detalhes' })
  await beto.getByRole('button', { name: 'Cancelar reserva', exact: true }).click()
  await beto.getByRole('button', { name: 'Cancelar reserva mesmo' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Beto Lima' }).filter({ hasText: 'Cancelada' })).toBeVisible()
  await page.goto(urlBeto)
  await expect(page.getByRole('note')).toContainText('Reserva cancelada.')
  await expect(page.getByRole('button', { name: 'Registrar pagamento' })).toHaveCount(0)
  await page.goto('/cobrancas')
  await expect(page.getByText('Beto Lima')).toHaveCount(0)

  // "Export all my data" includes reservations and payments (LGPD)
  const reservasCsv = await (await page.request.get('/exportar?tipo=reservas')).text()
  expect(reservasCsv).toContain('Cliente;Passeio;Data da saída;Pessoas;Valor total;Pago;Falta pagar')
  expect(reservasCsv).toContain('Ana Souza;Lisboa clássica;10/03/2027;2;1800,00;1800,00;0,00;')
  expect(reservasCsv).toMatch(/Beto Lima;Lisboa clássica;10\/03\/2027;1;1000,00;0,00;1000,00;\d{2}\/\d{2}\/\d{4};Cancelada/)
  const pagamentosCsv = await (await page.request.get('/exportar?tipo=pagamentos')).text()
  expect(pagamentosCsv).toContain('Cliente;Passeio;Data da saída;Data do pagamento;Tipo;Forma;Valor;Observação')
  expect(pagamentosCsv).toContain(';Sinal;Pix;500,00;')
  expect(pagamentosCsv).toContain(';Estorno;Pix;500,00;')
  expect(pagamentosCsv).toContain(';Saldo;Pix;1200,00;')
  await page.goto('/configuracoes')
  for (const nome of [/Baixar reservas/, /Baixar pagamentos/, /Baixar acompanhantes/]) await expect(page.getByRole('link', { name: nome })).toBeVisible()

  // Another agency cannot see them
  const contexto = await browser.newContext({ baseURL: 'http://localhost:3100' })
  const outra = await contexto.newPage()
  await cadastrar(outra, 'outra-pagtos')
  await outra.goto(urlAna)
  await expect(outra.getByText('could not be found')).toBeVisible()
  await outra.goto('/cobrancas')
  await expect(outra.getByText('Nada a receber neste filtro.')).toBeVisible()
  await contexto.close()
})
