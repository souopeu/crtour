import { expect, test } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day

test('commission: three rules configured by the owner, due when the reservation is paid, per seller', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa comissão')
  await page.getByLabel('Nome da agência').fill('Agência comissão')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-comissao-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza')
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
  await page.getByLabel(/Buscar cliente/).fill('ana')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: /Ana Souza/ }).click()
  await page.getByLabel('Número de pessoas').fill('2')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: 'Ana Souza' }).filter({ visible: true }).getByRole('link', { name: 'Pagamentos e detalhes' }).click()
  await expect(page.getByRole('heading', { name: /Reserva de Ana Souza/ })).toBeVisible()
  const urlReserva = page.url()
  await expect(page.getByLabel('Vendido por')).toHaveValue(/.+/) // the creator is the seller

  // No rule yet
  await page.goto('/comissoes')
  await expect(page.getByText(/A agência ainda não usa comissão/)).toBeVisible()

  // Rule 1: % per seller
  await page.goto('/configuracoes')
  const secao = page.getByRole('region', { name: 'Comissão' })
  await secao.getByLabel(/% por vendedor/).check()
  await secao.getByRole('button', { name: 'Salvar regra' }).click()
  await expect(secao.getByText('Regra salva.')).toBeVisible()
  const pessoas = secao.getByRole('group', { name: 'Percentual de cada pessoa' })
  await pessoas.getByLabel('Pessoa comissão').fill('abc')
  await pessoas.getByRole('button', { name: 'Salvar' }).click()
  await expect(pessoas.getByText(/Use um percentual de 0 a 100/)).toBeVisible()
  await pessoas.getByLabel('Pessoa comissão').fill('5')
  await pessoas.getByRole('button', { name: 'Salvar' }).click()
  await expect(pessoas.getByText('Salvo.')).toBeVisible()

  // Not paid yet: nothing due
  await page.goto('/comissoes')
  await expect(page.getByText('Nenhuma reserva quitada neste mês.')).toBeVisible()

  // Paid in full this month
  await page.goto(urlReserva)
  await page.getByLabel('Valor (R$)', { exact: true }).fill('2.000,00')
  await page.getByLabel('Data do pagamento').fill(iso(0))
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('Pagamento registrado.')).toBeVisible()
  await page.goto('/comissoes')
  const total = page.getByRole('region', { name: /Comissões de/ })
  await expect(total).toContainText('R$ 100,00')
  await expect(total.getByRole('list', { name: 'Por pessoa' })).toContainText('Pessoa comissão: R$ 100,00 (1 reserva)')
  await expect(page.getByRole('row', { name: /Ana Souza/ })).toContainText('Lisboa clássica · 10/03/2027 · 2 pessoas')

  // Rule 2: % per tour
  await page.goto('/configuracoes')
  await secao.getByLabel(/% por passeio/).check()
  await secao.getByRole('button', { name: 'Salvar regra' }).click()
  await expect(secao.getByText('Regra salva.')).toBeVisible()
  const passeios = secao.getByRole('group', { name: 'Percentual de cada passeio' })
  await passeios.getByLabel('Lisboa clássica').fill('10')
  await passeios.getByRole('button', { name: 'Salvar' }).click()
  await expect(passeios.getByText('Salvo.')).toBeVisible()
  await page.goto('/comissoes')
  await expect(total).toContainText('R$ 200,00')

  // Rule 3: fixed per passenger
  await page.goto('/configuracoes')
  await secao.getByLabel(/Valor fixo por passageiro/).check()
  await secao.getByRole('button', { name: 'Salvar regra' }).click()
  await expect(secao.getByText('Regra salva.')).toBeVisible()
  const porPessoa = secao.getByRole('group', { name: 'Valor por passageiro de cada passeio' })
  await porPessoa.getByLabel('Lisboa clássica').fill('50,00')
  await porPessoa.getByRole('button', { name: 'Salvar' }).click()
  await expect(porPessoa.getByText('Salvo.')).toBeVisible()
  await page.goto('/comissoes')
  await expect(total).toContainText('R$ 100,00')

  // The owner says nobody sold it: it shows as "Sem vendedor(a)"
  await page.goto(urlReserva)
  await page.getByLabel('Vendido por').selectOption({ label: 'Ninguém' })
  await page.getByRole('button', { name: 'Salvar vendedor(a)' }).click()
  await expect(page.getByText('Vendedor(a) salvo.')).toBeVisible()
  await page.goto('/comissoes')
  await expect(total.getByRole('list', { name: 'Por pessoa' })).toContainText('Sem vendedor(a): R$ 100,00 (1 reserva)')
})
