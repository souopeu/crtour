import { expect, test, type Page } from '@playwright/test'

async function cadastrar(page: Page, rotulo: string) {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill(`Pessoa ${rotulo}`)
  await page.getByLabel('Nome da agência').fill(`Agência ${rotulo}`)
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-${rotulo}-${Date.now()}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('link', { name: 'Funil' })).toBeVisible()
}

async function novoCliente(page: Page, nome: string) {
  await page.goto('/clientes/novo')
  await expect(page.getByRole('heading', { name: 'Novo cliente' })).toBeVisible()
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
  return page.url()
}

test('funnel: create deals, automatic forecast, stage defaults, history, grouping, isolation', async ({ page, browser }) => {
  await cadastrar(page, 'funil')
  const urlAna = await novoCliente(page, 'Ana Souza')
  await novoCliente(page, 'Beto Lima')

  await page.getByRole('link', { name: 'Funil' }).click()
  await expect(page.getByRole('heading', { name: 'Funil de vendas' })).toBeVisible()
  await expect(page.getByText('Nenhuma negociação ainda.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Kanban' })).toHaveAttribute('aria-current', 'page')

  // From the client sheet
  await page.goto(urlAna)
  await expect(page.getByText('Nenhuma negociação para este cliente.')).toBeVisible()
  await page.getByRole('link', { name: 'Nova negociação' }).click()
  await expect(page.getByText('Negociação para Ana Souza.')).toBeVisible()
  await page.getByRole('button', { name: 'Criar negociação' }).click()
  await expect(page.getByText('Digite o título da negociação.')).toBeVisible()
  await page.getByLabel('Título').fill('Lisboa em março')
  await page.getByLabel('Valor (R$)').fill('10.000,00')
  await page.getByRole('button', { name: 'Criar negociação' }).click()
  await expect(page).toHaveURL(/\/negociacoes\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: 'Lisboa em março', level: 1 })).toBeVisible()
  const urlNeg = page.url()
  await expect(page.getByText(/Interessado · 10%/)).toBeVisible()
  await expect(page.getByText('previsto R$ 1.000,00')).toBeVisible() // 10% of 10.000,00, computed by the database

  // A stage change applies that stage's default probability
  await page.getByLabel('Etapa', { exact: true }).selectOption('orcamento')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Alterações salvas.')).toBeVisible()
  await expect(page.getByText(/Orçamento · 30%/)).toBeVisible()
  await expect(page.getByText('previsto R$ 3.000,00')).toBeVisible()

  // A manual probability sticks until the next stage change
  await page.getByLabel('Probabilidade (%)').fill('50')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('previsto R$ 5.000,00')).toBeVisible()
  await page.getByLabel('Etapa', { exact: true }).selectOption('reservado')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText(/Reservado · 70%/)).toBeVisible()
  await expect(page.getByText('previsto R$ 7.000,00')).toBeVisible()

  // Winning stamps the closing date; going back clears it
  await page.getByLabel('Etapa', { exact: true }).selectOption('pago')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText(/Pago · 100%/)).toBeVisible()
  await expect(page.getByText('previsto R$ 10.000,00')).toBeVisible()
  await expect(page.getByText(/Fechada em \d{2}\/\d{2}\/\d{4}/)).toBeVisible()
  await page.getByLabel('Etapa', { exact: true }).selectOption('orcamento')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText(/Orçamento · 30%/)).toBeVisible()
  await expect(page.getByText(/Fechada em/)).toHaveCount(0)

  // History
  const historico = page.getByRole('region', { name: 'Histórico de etapas' })
  await expect(historico).toContainText('Criada em Interessado')
  await expect(historico).toContainText('Interessado → Orçamento')
  await expect(historico).toContainText('Orçamento → Reservado')
  await expect(historico).toContainText('Reservado → Pago')
  await expect(historico).toContainText('Pago → Orçamento')
  await expect(historico).toContainText('Pessoa funil')

  // The person in charge, then a second deal through the search flow (no value => forecast 0)
  await page.getByRole('region', { name: 'Dados da negociação' }).getByLabel('Responsável', { exact: true }).selectOption({ label: 'Pessoa funil' })
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Alterações salvas.')).toBeVisible()

  await page.goto('/negociacoes/novo')
  await page.getByLabel(/Para qual cliente/).fill('beto')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: /Beto Lima/ }).click()
  await page.getByLabel('Título').fill('Noronha em julho')
  await page.getByRole('button', { name: 'Criar negociação' }).click()
  await expect(page.getByText('previsto R$ 0,00')).toBeVisible()

  // Table: grouped by stage in funnel order, with money totals and no probability sum
  await page.goto('/funil?visao=tabela')
  await expect(page.getByText('2 negociações · valor R$ 10.000,00 · previsto R$ 3.000,00')).toBeVisible()
  const grupos = page.getByRole('heading', { level: 2 })
  await expect(grupos).toHaveText(['Interessado (1)', 'Orçamento (1)'])
  const orcamento = page.getByRole('region', { name: /Orçamento/ })
  await expect(orcamento).toContainText('Valor R$ 10.000,00')
  await expect(orcamento).toContainText('previsto R$ 3.000,00')
  await expect(orcamento).toContainText('Lisboa em março')
  await expect(orcamento).toContainText('Ana Souza')
  await expect(orcamento).toContainText('30%')
  await expect(page.getByText(/soma.*probabilidade/i)).toHaveCount(0)

  // Summary row at the bottom of each group (R61)
  await expect(orcamento.getByRole('row', { name: /^Total/ })).toContainText('R$ 10.000,00')
  await expect(orcamento.getByRole('row', { name: /^Total/ })).toContainText('R$ 3.000,00')
  await expect(page.getByRole('link', { name: '+ Adicionar negociação' }).first()).toBeVisible()

  // Groups fold and unfold
  const interessado = page.getByRole('button', { name: 'Interessado (1)' })
  await interessado.click()
  await expect(interessado).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('link', { name: 'Noronha em julho' })).toBeHidden()
  await interessado.click()
  await expect(page.getByRole('link', { name: 'Noronha em julho' })).toBeVisible()

  // Grouped by person in charge, with the stage shown as a labelled block
  await page.getByLabel('Agrupar por').selectOption('responsavel')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(grupos).toHaveText(['Pessoa funil (1)', 'Sem responsável (1)'])
  await expect(page.getByRole('region', { name: /Pessoa funil/ })).toContainText('Orçamento')

  // Toolbar: search and person filter survive switching views (R60)
  await page.getByLabel('Buscar negociação').fill('lisboa')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(grupos).toHaveText(['Pessoa funil (1)'])
  await page.getByRole('link', { name: 'Kanban' }).click()
  await expect(page).toHaveURL(/q=lisboa/)
  await expect(page.getByRole('link', { name: 'Lisboa em março' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Noronha em julho' })).toHaveCount(0)
  await expect(page.getByLabel('Buscar negociação')).toHaveValue('lisboa')
  await page.getByLabel('Buscar negociação').fill('')
  await page.getByLabel('Pessoa', { exact: true }).selectOption({ label: 'Sem responsável' })
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('link', { name: 'Noronha em julho' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lisboa em março' })).toHaveCount(0)

  // The client sheet lists the deal
  await page.goto(urlAna)
  const negociacoes = page.getByRole('region', { name: 'Negociações' })
  await expect(negociacoes).toContainText('Lisboa em março')
  await expect(negociacoes).toContainText('Orçamento · 30%')

  // Another agency cannot open it
  const contexto = await browser.newContext({ baseURL: 'http://localhost:3100' })
  const outra = await contexto.newPage()
  await cadastrar(outra, 'outra-funil')
  await outra.goto(urlNeg)
  await expect(outra.getByText('could not be found')).toBeVisible()
  await outra.goto('/funil')
  await expect(outra.getByText('Nenhuma negociação ainda.')).toBeVisible()
  await contexto.close()
})
