import { expect, test } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day (UTC-3)
const br = (data: string) => data.split('-').reverse().join('/')

// E10-3 (R151): the day's money per payment form; checking the day, and the check falling when a movement changes.
// E10-4 (R152): the month overview shows the same numbers.
test('conferência diária e visão geral do mês', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa caixa')
  await page.getByLabel('Nome da agência').fill('Agência caixa')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-caixa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Bia Caixa')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Bia Caixa' })).toBeVisible()
  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Cachoeira')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Cachoeira', level: 1 })).toBeVisible()
  await page.getByLabel('Data da saída').fill(iso(5))
  await page.getByLabel('Vagas (capacidade)').fill('10')
  await page.getByLabel('Preço por pessoa (R$)').fill('100,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await page.getByRole('link', { name: new RegExp(br(iso(5)).replace(/\//g, '\\/')) }).click()
  await expect(page.getByRole('heading', { name: `Saída de ${br(iso(5))}` })).toBeVisible()
  await page.getByLabel(/Buscar cliente/).fill('bia')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: /Bia Caixa/ }).click()
  await page.getByLabel('Número de pessoas').fill('2')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: 'Bia Caixa' }).filter({ visible: true }).getByRole('link', { name: 'Pagamentos e detalhes' }).click()
  await expect(page.getByLabel('Valor (R$)', { exact: true })).toBeVisible()
  const urlReserva = page.url()

  // R$ 50,00 in Pix and R$ 30,00 in cash today
  for (const [valor, forma, falta] of [['50,00', 'pix', '150,00'], ['30,00', 'dinheiro', '120,00']] as const) {
    await page.getByLabel('Valor (R$)', { exact: true }).fill(valor)
    await page.getByLabel('Forma de pagamento').selectOption(forma)
    await page.getByRole('button', { name: 'Registrar pagamento' }).click()
    await expect(page.getByText(`Falta R$ ${falta}.`)).toBeVisible()
  }

  await page.goto('/financeiro/conferencia')
  const porForma = page.getByRole('table', { name: 'Totais por forma de pagamento' })
  await expect(porForma.getByRole('row', { name: /Pix/ })).toContainText('R$ 50,00')
  await expect(porForma.getByRole('row', { name: /Dinheiro/ })).toContainText('R$ 30,00')
  await expect(page.getByRole('region', { name: 'Totais do dia' })).toContainText('R$ 80,00')
  await expect(page.getByRole('table', { name: 'Movimentos do dia' }).getByRole('link', { name: /Bia Caixa/ })).toHaveCount(2)

  await expect(page.getByText('Este dia ainda não foi conferido.')).toBeVisible()
  await page.getByRole('form', { name: 'Conferir o dia' }).getByLabel('Observação (opcional)').fill('Caixa batido')
  await page.getByRole('button', { name: 'Conferi este dia' }).click()
  await expect(page.getByText(/Conferido por Pessoa caixa/)).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Conferido por' })).toContainText('Caixa batido')

  // A new payment on the same day undoes the check
  await page.goto(urlReserva)
  await page.getByLabel('Valor (R$)', { exact: true }).fill('20,00')
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('Falta R$ 100,00.')).toBeVisible()
  await page.goto('/financeiro/conferencia')
  await expect(page.getByText(/Um lançamento deste dia mudou/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Totais do dia' })).toContainText('R$ 100,00')

  // R152: the month overview agrees with the daily check and with Cobranças
  await page.goto('/financeiro')
  await expect(page.getByRole('region', { name: 'Vendido' })).toContainText('R$ 200,00')
  await expect(page.getByRole('region', { name: 'Recebido' })).toContainText('R$ 100,00')
  await expect(page.getByRole('region', { name: 'A receber' })).toContainText('R$ 100,00')
  await expect(page.getByRole('region', { name: 'Resultado de caixa' })).toContainText('R$ 100,00')
  await page.getByRole('region', { name: 'A receber' }).getByRole('link', { name: 'Ver cobranças' }).click()
  await expect(page.getByText('1 reserva · R$ 100,00 a receber')).toBeVisible()
})
