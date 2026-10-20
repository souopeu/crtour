import { expect, test, type Page } from '@playwright/test'

const mesAnterior = () => {
  const d = new Date(Date.now() - 3 * 3_600_000) // Brazil
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - 1)
  return d.toISOString().slice(0, 7)
}

async function cadastrar(page: Page) {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa painel')
  await page.getByLabel('Nome da agência').fill('Agência painel')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-painel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('link', { name: 'Painel' })).toBeVisible()
}

async function novaNegociacao(page: Page, urlCliente: string, titulo: string, valor: string) {
  await page.goto(urlCliente)
  await page.getByRole('link', { name: 'Nova negociação' }).click()
  await page.getByLabel('Título').fill(titulo)
  await page.getByLabel('Valor (R$)').fill(valor)
  await page.getByRole('button', { name: 'Criar negociação' }).click()
  await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
}

async function mover(page: Page, titulo: string, etapa: string) {
  await page.getByLabel(`Mover ${titulo} para`).selectOption(etapa)
  if (etapa === 'perdido') {
    const dialogo = page.getByRole('dialog')
    await dialogo.getByLabel('Motivo da perda').selectOption('achou_caro')
    await dialogo.getByRole('button', { name: 'Marcar como perdida' }).click()
  }
  await expect(page.getByText('Negociação movida.')).toBeVisible()
}

test('painel: numbers match known data, monthly goal, period and person filters', async ({ page }) => {
  await cadastrar(page)

  await page.goto('/painel')
  await expect(page.getByText(/Ainda não há negociações/)).toBeVisible()

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Souza' })).toBeVisible()
  const ana = page.url()

  await novaNegociacao(page, ana, 'Lisboa', '10.000,00')
  await page.getByRole('region', { name: 'Dados da negociação' }).getByLabel('Responsável', { exact: true }).selectOption({ label: 'Pessoa painel' })
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Alterações salvas.')).toBeVisible()
  await novaNegociacao(page, ana, 'Porto', '5.000,00')
  await novaNegociacao(page, ana, 'Praia', '2.000,00')

  await page.goto('/funil')
  await mover(page, 'Lisboa', 'pago')
  await page.goto('/funil')
  await mover(page, 'Praia', 'perdido')

  // Known data: won 10.000 this month, lost 2.000 (Achou caro), open 5.000 at 10%
  await page.goto('/painel')
  const meta = page.getByRole('region', { name: /^Meta de/ })
  await expect(meta).toContainText('Nenhuma meta definida para este mês.')
  await expect(page.getByText(/^Receita efetiva em/).locator('..')).toContainText('R$ 10.000,00')
  await expect(page.getByText(/^Receita efetiva em/).locator('..')).toContainText('1 venda em Pago ou depois')
  await expect(page.getByText('Ticket médio').locator('..')).toContainText('R$ 10.000,00')
  await expect(page.getByText('Conversão no mês').locator('..')).toContainText('50%')
  await expect(page.getByText('Conversão no mês').locator('..')).toContainText('1 ganhas · 1 perdidas')
  await expect(page.getByText('Pipeline aberto (agora)').locator('..')).toContainText('R$ 5.000,00')
  await expect(page.getByText('Pipeline aberto (agora)').locator('..')).toContainText('1 em aberto · previsto R$ 500,00')

  const porEtapa = page.getByRole('region', { name: /Por etapa/ })
  await expect(porEtapa.getByRole('row', { name: /^Interessado/ })).toContainText('1R$ 5.000,00R$ 500,00')
  await expect(porEtapa.getByRole('row', { name: /^Pago/ })).toContainText('1R$ 10.000,00R$ 10.000,00')
  const funil = page.getByRole('region', { name: /^Funil/ })
  await expect(funil.getByRole('row', { name: /^Interessado/ })).toContainText('3')
  await expect(funil.getByRole('row', { name: /^Orçamento/ })).toContainText('1') // only Lisboa got past Interessado
  await expect(funil.getByRole('row', { name: /^Orçamento/ })).toContainText('67%')
  await expect(page.getByRole('region', { name: /Perdas por motivo/ })).toContainText('Achou caro1R$ 2.000,00')
  await expect(page.getByRole('region', { name: /Previsão por mês/ })).toContainText('Sem data1R$ 500,00')
  // R120: pie of open deals by stage and the forecast line (the undated deal is told in text)
  const pizza = page.getByRole('region', { name: 'Negociações abertas por etapa' })
  await expect(pizza).toContainText('Interessado: 100% (1)')
  await expect(pizza).toContainText('Orçamento: 0% (0)')
  await expect(page.getByRole('region', { name: 'Previsão mensal' })).toContainText('Fora do gráfico: sem data (1)')

  // R97: six months, the chosen one with what was sold and lost; no goal column without a goal
  const grafico = page.getByRole('region', { name: 'Vendas nos últimos 6 meses' })
  await expect(grafico.getByRole('row')).toHaveCount(7)
  await expect(grafico.getByRole('row').last()).toContainText('R$ 10.000,00R$ 2.000,00')
  await expect(grafico.getByRole('columnheader', { name: 'Meta' })).toHaveCount(0)

  // R96: Ana arrived with no campaign; her one client is sold
  await page.goto('/campanhas')
  await expect(page.getByRole('list', { name: 'Resultado por campanha' })).toContainText('1 vendido0 perdidos0 em aberto')
  await page.goto('/painel')

  // Monthly goal: only effective revenue counts
  await meta.getByLabel(/Meta de/).fill('abc')
  await meta.getByRole('button', { name: 'Salvar meta' }).click()
  await expect(page.getByText('Digite a meta em reais, ex.: 50.000,00.')).toBeVisible()
  await meta.getByLabel(/Meta de/).fill('40.000,00')
  await meta.getByRole('button', { name: 'Salvar meta' }).click()
  await expect(meta).toContainText('R$ 10.000,00 de R$ 40.000,00 (25%)')
  await expect(meta).toContainText('Faltam R$ 30.000,00.')
  await expect(meta.getByRole('meter')).toHaveAttribute('aria-valuetext', '25% da meta')
  await expect(meta.getByRole('meter')).toContainText('AtualR$ 10.000,00')
  await expect(meta.getByRole('meter')).toContainText('MetaR$ 40.000,00')
  await expect(grafico.getByRole('row').last()).toContainText('R$ 40.000,00')

  // Person filter: only Lisboa is theirs
  await page.getByLabel('Responsável').selectOption({ label: 'Pessoa painel' })
  await page.getByRole('button', { name: 'Ver' }).click()
  await expect(page.getByText('Conversão no mês').locator('..')).toContainText('100%')
  await expect(page.getByText('Pipeline aberto (agora)').locator('..')).toContainText('R$ 0,00')
  await expect(page.getByText(/A meta é da agência toda/)).toBeVisible()
  await expect(grafico.getByRole('row').last()).toContainText('R$ 10.000,00R$ 0,00')
  await expect(grafico.getByRole('columnheader', { name: 'Meta' })).toHaveCount(0)

  // Previous month: nothing closed there, and no goal yet
  await page.goto(`/painel?mes=${mesAnterior()}`)
  await expect(page.getByText(/^Receita efetiva em/).locator('..')).toContainText('R$ 0,00')
  await expect(page.getByText('Conversão no mês').locator('..')).toContainText('—')
  await expect(page.getByRole('region', { name: /^Meta de/ })).toContainText('Nenhuma meta definida para este mês.')
})
