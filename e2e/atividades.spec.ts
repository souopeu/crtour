import { expect, test, type Page } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day
const br = (d: string) => d.split('-').reverse().join('/')

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

async function agendar(page: Page, titulo: string, quando: string, situacao: 'pendente' | 'feito', tipo = 'Ligação') {
  const secao = page.getByRole('region', { name: 'Atividades' })
  await secao.getByLabel('Tipo').selectOption({ label: tipo })
  await secao.getByLabel('O que fazer ou o que foi feito').fill(titulo)
  await secao.getByLabel('Data e hora').fill(quando)
  await secao.getByLabel('Situação').selectOption(situacao)
  await secao.getByRole('button', { name: 'Salvar atividade' }).click()
  await expect(page.getByText(situacao === 'feito' ? 'Atividade registrada.' : 'Atividade agendada.')).toBeVisible()
}

test('activities, last interaction, timeline and WhatsApp registration', async ({ page, context }) => {
  await cadastrar(page, 'atividades')
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza')
  await page.getByRole('textbox', { name: /WhatsApp/ }).fill('(11) 99999-0001')
  await page.getByLabel('Consentimento').selectOption('aceitou')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Souza' })).toBeVisible()
  const urlAna = page.url()

  // A deal to link activities to
  await page.getByRole('link', { name: 'Nova negociação' }).click()
  await page.getByLabel('Título').fill('Lisboa em março')
  await page.getByRole('button', { name: 'Criar negociação' }).click()
  await expect(page.getByRole('heading', { name: 'Lisboa em março', level: 1 })).toBeVisible()
  await page.goto(urlAna)

  const secao = page.getByRole('region', { name: 'Atividades' })
  const linha = page.getByRole('region', { name: 'Linha do tempo' })
  await expect(page.getByText('Nenhuma interação registrada')).toBeVisible()
  await expect(secao).toContainText('Nenhuma atividade ainda.')

  // Validation
  await secao.getByRole('button', { name: 'Salvar atividade' }).click()
  await expect(page.getByText('Digite o título da atividade.')).toBeVisible()

  // A pending activity is not an interaction; a past one is flagged late
  await agendar(page, 'Ligar para a Ana', `${iso(1)}T10:00`, 'pendente')
  await agendar(page, 'Enviar proposta', `${iso(-1)}T09:00`, 'pendente', 'Tarefa')
  await expect(page.getByText('Nenhuma interação registrada')).toBeVisible()
  const ligar = secao.getByRole('listitem').filter({ hasText: 'Ligar para a Ana' })
  const proposta = secao.getByRole('listitem').filter({ hasText: 'Enviar proposta' })
  await expect(proposta).toContainText('atrasada')
  await expect(ligar).not.toContainText('atrasada')
  await expect(linha).toContainText('Ligação (a fazer)')

  // Marking one as done sets the last interaction (today) and the timeline says "feita"
  await ligar.getByRole('button', { name: 'Marcar como feita' }).click()
  await expect(page.getByText(`Última interação: ${br(iso(0))} (hoje)`)).toBeVisible()
  await expect(linha).toContainText('Ligação (feita)')
  await expect(secao.getByRole('listitem').filter({ hasText: 'Ligar para a Ana' }).getByRole('button', { name: /Desfazer/ })).toBeVisible()

  // Undo recalculates
  await secao.getByRole('listitem').filter({ hasText: 'Ligar para a Ana' }).getByRole('button', { name: /Desfazer/ }).click()
  await expect(page.getByText('Nenhuma interação registrada')).toBeVisible()

  // A note alone never counts
  await page.getByLabel('Nova anotação').fill('Cliente pediu desconto')
  await page.getByRole('button', { name: 'Salvar anotação' }).click()
  await expect(linha).toContainText('Anotação')
  await expect(linha).toContainText('Cliente pediu desconto')
  await expect(page.getByText('Nenhuma interação registrada')).toBeVisible()

  // A contact from 3 days ago logged as done, linked to the deal
  await secao.getByLabel('Negociação (opcional)').selectOption({ label: 'Lisboa em março' })
  await agendar(page, 'Reunião sobre datas', `${iso(-3)}T10:00`, 'feito', 'Reunião')
  await expect(page.getByText(`Última interação: ${br(iso(-3))} (há 3 dias)`)).toBeVisible()
  await expect(secao.getByRole('listitem').filter({ hasText: 'Reunião sobre datas' })).toContainText('Negociação: Lisboa em março')

  // WhatsApp: open the link, then register it with one tap
  await context.route('https://wa.me/**', (rota) => rota.fulfill({ status: 200, contentType: 'text/html', body: '<p>wa.me</p>' }))
  const aba = context.waitForEvent('page')
  await page.getByRole('link', { name: 'Chamar no WhatsApp' }).click()
  await (await aba).close()
  await page.getByRole('button', { name: 'Registrar como feito' }).click()
  await expect(page.getByText('Registrado na linha do tempo.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar como feito' })).toHaveCount(0)
  await expect(page.getByText(`Última interação: ${br(iso(0))} (hoje)`)).toBeVisible()
  await expect(linha).toContainText('WhatsApp (feita)')
  await expect(linha).toContainText('WhatsApp: Olá, Ana! Tudo bem?')

  // Deleting the latest done activity falls back to the previous one
  const zap = secao.getByRole('listitem').filter({ hasText: 'WhatsApp: Olá, Ana' })
  await zap.getByRole('button', { name: 'Apagar atividade' }).click()
  await zap.getByRole('button', { name: 'Apagar mesmo' }).click()
  await expect(page.getByText(`Última interação: ${br(iso(-3))} (há 3 dias)`)).toBeVisible()
  await expect(linha).not.toContainText('WhatsApp (feita)')

  // It all survives a reload
  await page.reload()
  await expect(page.getByText(`Última interação: ${br(iso(-3))} (há 3 dias)`)).toBeVisible()
  await expect(secao).toContainText('Enviar proposta')
})
