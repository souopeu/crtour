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

async function novaNegociacao(page: Page, busca: string, cliente: string, titulo: string, valor: string) {
  await page.goto('/negociacoes/novo')
  await page.getByLabel(/Para qual cliente/).fill(busca)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: new RegExp(cliente) }).click()
  await page.getByLabel('Título').fill(titulo)
  await page.getByLabel('Valor (R$)').fill(valor)
  await page.getByRole('button', { name: 'Criar negociação' }).click()
  await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
  return page.url()
}

const coluna = (page: Page, nome: string) => page.getByRole('listitem', { name: `Etapa ${nome}` })

test('kanban: move by menu and by drag, totals, lost with reason, resume, win notice', async ({ page }) => {
  await cadastrar(page, 'kanban')
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Souza' })).toBeVisible()

  const urlLisboa = await novaNegociacao(page, 'ana', 'Ana Souza', 'Lisboa em março', '10.000,00')
  await novaNegociacao(page, 'ana', 'Ana Souza', 'Noronha em julho', '5.000,00')

  await page.goto('/funil')
  await expect(coluna(page, 'Interessado')).toContainText('Interessado (2)')
  await expect(coluna(page, 'Interessado')).toContainText('Valor R$ 15.000,00')
  await expect(coluna(page, 'Interessado')).toContainText('previsto R$ 1.500,00')
  await expect(coluna(page, 'Orçamento')).toContainText('Solte uma negociação aqui.')

  // Move with the keyboard-friendly menu; totals update right away and the default probability applies
  await page.getByLabel('Mover Lisboa em março para').selectOption('orcamento')
  await expect(page.getByText('Negociação movida.')).toBeVisible()
  await expect(coluna(page, 'Orçamento')).toContainText('Lisboa em março')
  await expect(coluna(page, 'Orçamento')).toContainText('Orçamento (1)')
  await expect(coluna(page, 'Orçamento')).toContainText('previsto R$ 3.000,00') // 30% of 10.000
  await expect(coluna(page, 'Interessado')).toContainText('Valor R$ 5.000,00')

  // Move by dragging
  await coluna(page, 'Interessado').getByText('Noronha em julho').dragTo(coluna(page, 'Reservado'))
  await expect(coluna(page, 'Reservado')).toContainText('Noronha em julho')
  await expect(coluna(page, 'Reservado')).toContainText('70%')
  await expect(coluna(page, 'Reservado')).toContainText('previsto R$ 3.500,00')
  await expect(page.getByText('Negociação movida.')).toBeVisible()

  // Survives a reload (it was saved) and matches the table view
  await page.reload()
  await expect(coluna(page, 'Reservado')).toContainText('Noronha em julho')
  await page.getByRole('link', { name: 'Tabela', exact: true }).click()
  await expect(page.getByRole('region', { name: /Reservado/ })).toContainText('Noronha em julho')
  await expect(page.getByText('2 negociações · valor R$ 15.000,00 · previsto R$ 6.500,00')).toBeVisible()
  await page.getByRole('link', { name: 'Kanban' }).click()

  // Lost: the reason is mandatory (dialog), then it shows on the deal and in its history
  await page.getByLabel('Mover Lisboa em março para').selectOption('perdido')
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toContainText('Por que perdeu "Lisboa em março"?')
  await dialogo.getByRole('button', { name: 'Marcar como perdida' }).click()
  await expect(dialogo.getByText('Escolha o motivo da perda.')).toBeVisible()
  await dialogo.getByLabel('Motivo da perda').selectOption('outro')
  await dialogo.getByRole('button', { name: 'Marcar como perdida' }).click()
  await expect(dialogo.getByText('Descreva o motivo da perda.')).toBeVisible()
  await dialogo.getByLabel('Descreva o motivo').fill('Sem verba este ano')
  await dialogo.getByRole('button', { name: 'Marcar como perdida' }).click()
  await expect(coluna(page, 'Perdido')).toContainText('Lisboa em março')
  await expect(coluna(page, 'Perdido')).toContainText('0%')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Negociação movida.')).toBeVisible() // the server has saved it (the card moves optimistically before)

  await page.goto(urlLisboa)
  await expect(page.getByText('Motivo da perda: Outro (Sem verba este ano)')).toBeVisible()
  const historico = page.getByRole('region', { name: 'Histórico de etapas' })
  await expect(historico).toContainText('Orçamento → Perdido')
  await expect(historico).toContainText('Motivo: Outro')

  // Cancelling the dialog leaves the card where it was
  await page.goto('/funil')
  await page.getByLabel('Mover Noronha em julho para').selectOption('perdido')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
  await expect(coluna(page, 'Reservado')).toContainText('Noronha em julho')
  await expect(page.getByLabel('Mover Noronha em julho para')).toHaveValue('reservado')

  // Resume the lost deal: it comes back and the reason no longer applies
  await page.getByLabel('Mover Lisboa em março para').selectOption('orcamento')
  await expect(coluna(page, 'Orçamento')).toContainText('Lisboa em março')
  await expect(page.getByText('Negociação movida.')).toBeVisible()
  await page.goto(urlLisboa)
  await expect(page.getByText(/Motivo da perda/)).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Histórico de etapas' })).toContainText('Perdido → Orçamento')

  // Winning notifies the owner: badge, list, mark as read
  await page.goto('/avisos')
  await expect(page.getByText('Nenhum aviso ainda.')).toBeVisible()
  await page.goto('/funil')
  await expect(page.getByText(/Fechadas nos últimos 30 dias:\s*0 negociações/)).toBeVisible()
  await page.getByLabel('Mover Noronha em julho para').selectOption('pago')
  await expect(coluna(page, 'Pago')).toContainText('Noronha em julho')
  await expect(coluna(page, 'Pago')).toContainText('100%')
  await expect(page.getByText('Negociação movida.')).toBeVisible()
  await page.reload()
  await expect(page.getByText(/Fechadas nos últimos 30 dias:\s*1 negociação ·/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Avisos/ })).toContainText('1')
  await page.getByRole('link', { name: /Avisos/ }).click()
  await expect(page.getByText('1 aviso novo')).toBeVisible()
  const aviso = page.getByRole('listitem').filter({ hasText: 'Venda fechada: Noronha em julho' })
  await expect(aviso).toContainText('Ana Souza · R$ 5.000,00')
  await expect(aviso).toContainText('Movida para Pago por Pessoa kanban')
  await aviso.getByRole('button', { name: 'Marcar como lido' }).click()
  await expect(page.getByText('Tudo lido.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Avisos/ })).not.toContainText('1')
})
