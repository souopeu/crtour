import { expect, test, type Page } from '@playwright/test'
import { atualizar, diasAtras } from './banco'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day
const idDaUrl = (page: Page) => page.url().split('/').pop()!.split('?')[0]

async function cadastrar(page: Page) {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa hoje')
  await page.getByLabel('Nome da agência').fill('Agência hoje')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-hoje-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('link', { name: 'Hoje' })).toBeVisible()
}

async function novoCliente(page: Page, nome: string, whatsapp: string, consentimento: string) {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  if (whatsapp) await page.getByRole('textbox', { name: /WhatsApp/ }).fill(whatsapp)
  await page.getByLabel('Consentimento').selectOption(consentimento)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
  return idDaUrl(page)
}

async function atividade(page: Page, titulo: string, quando: string, situacao: 'pendente' | 'feito') {
  const secao = page.getByRole('region', { name: 'Atividades' })
  await secao.getByLabel('O que fazer ou o que foi feito').fill(titulo)
  await secao.getByLabel('Data e hora').fill(quando)
  await secao.getByLabel('Situação').selectOption(situacao)
  await secao.getByRole('button', { name: 'Salvar atividade' }).click()
  await expect(secao.getByRole('listitem').filter({ hasText: titulo })).toBeVisible() // the previous save's message may still be on screen
  await expect(secao.getByLabel('O que fazer ou o que foi feito')).toHaveValue('')
}

async function novaNegociacao(page: Page, clienteId: string, titulo: string) {
  await page.goto(`/clientes/${clienteId}`)
  await page.getByRole('link', { name: 'Nova negociação' }).click()
  await page.getByLabel('Título').fill(titulo)
  await page.getByRole('button', { name: 'Criar negociação' }).click()
  await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
  return idDaUrl(page)
}

test('hoje: late and today activities, clients without contact, stalled deals, adjustable limits', async ({ page, context }) => {
  await cadastrar(page)
  const ana = await novoCliente(page, 'Ana Souza', '(11) 99999-0001', 'aceitou')
  await atividade(page, 'Enviar proposta', `${iso(-3)}T10:00`, 'pendente')
  await atividade(page, 'Ligar hoje', `${iso(0)}T23:30`, 'pendente')
  await atividade(page, 'Coisa futura', `${iso(2)}T10:00`, 'pendente')
  await atividade(page, 'Conversa antiga', `${iso(-40)}T10:00`, 'feito')

  const bruno = await novoCliente(page, 'Bruno Lima', '(11) 99999-0002', 'nao_informado')
  const caio = await novoCliente(page, 'Caio Lima', '(11) 99999-0003', 'pediu_saida')
  await novoCliente(page, 'Dora Nova', '', 'aceitou')
  await atualizar('clientes', bruno, { criado_em: diasAtras(35) })
  await atualizar('clientes', caio, { criado_em: diasAtras(35) })

  const lisboa = await novaNegociacao(page, ana, 'Lisboa em março')
  await novaNegociacao(page, ana, 'Praia recente')
  await atualizar('negociacoes', lisboa, { etapa_desde: diasAtras(10) })

  await page.getByRole('link', { name: 'Hoje' }).click()
  await expect(page.getByRole('heading', { name: 'Hoje', level: 1 })).toBeVisible()
  const atrasadas = page.getByRole('region', { name: /Atrasadas/ })
  const deHoje = page.getByRole('region', { name: /Para hoje/ })
  const semContato = page.getByRole('region', { name: /Sem contato/ })
  const paradas = page.getByRole('region', { name: /Negociações paradas/ })

  // Activities: late vs today; future ones stay on the sheet
  await expect(atrasadas).toContainText('Enviar proposta')
  await expect(atrasadas).toContainText('Atrasada há 3 dias')
  await expect(deHoje).toContainText('Ligar hoje')
  await expect(atrasadas).not.toContainText('Coisa futura')
  await expect(deHoje).not.toContainText('Coisa futura')
  await expect(atrasadas.getByRole('link', { name: 'Chamar Ana Souza no WhatsApp' })).toBeVisible()

  // Without contact: never contacted first, then the oldest contact; who asked to leave and who is new stay out
  await expect(semContato.getByRole('heading')).toHaveText('Sem contato há 30 dias ou mais (2)')
  const nomes = await semContato.getByRole('listitem').getByRole('link', { name: /^(Ana|Bruno|Caio|Dora) / }).allTextContents()
  expect(nomes).toEqual(['Bruno Lima', 'Ana Souza'])
  await expect(semContato).toContainText('Nenhum contato registrado; cadastrado há 35 dias')
  await expect(semContato).toContainText('Último contato há 40 dias')
  await expect(semContato.getByRole('listitem').filter({ hasText: 'Bruno Lima' })).toContainText('Consentimento não informado')

  // Stalled deals
  await expect(paradas).toContainText('Lisboa em março')
  await expect(paradas).toContainText('Parada em Interessado há 10 dias')
  await expect(paradas).not.toContainText('Praia recente')

  // "Feito" on the late activity removes it; it now counts as contact, so Ana leaves the list
  await atrasadas.getByRole('button', { name: 'Marcar como feita: Enviar proposta' }).click()
  await expect(atrasadas).toContainText('Nada atrasado.')
  await expect(semContato.getByRole('heading')).toHaveText('Sem contato há 30 dias ou mais (1)')

  // WhatsApp, then one tap to register: Bruno leaves the list too
  await context.route('https://wa.me/**', (rota) => rota.fulfill({ status: 200, contentType: 'text/html', body: '<p>wa.me</p>' }))
  const aba = context.waitForEvent('page')
  await semContato.getByRole('link', { name: 'Chamar Bruno Lima no WhatsApp' }).click()
  await (await aba).close()
  await semContato.getByRole('button', { name: 'Registrar como feito' }).click()
  await expect(semContato).toContainText('Todos os clientes tiveram contato recente.')

  // The kanban marks the stalled card with text, not only colour
  await page.goto('/funil')
  await expect(page.locator('li[draggable]').filter({ hasText: 'Lisboa em março' })).toContainText('Negociação parada')
  await expect(page.locator('li[draggable]').filter({ hasText: 'Praia recente' })).not.toContainText('Negociação parada')

  // The owner adjusts the limits
  await page.goto('/configuracoes')
  await page.getByLabel('Negociação parada depois de (dias na mesma etapa)').fill('0')
  await page.getByRole('button', { name: 'Salvar prazos' }).click()
  await expect(page.getByText('Use um número inteiro de dias, de 1 a 365.')).toBeVisible()
  await page.getByLabel('Negociação parada depois de (dias na mesma etapa)').fill('12')
  await page.getByRole('button', { name: 'Salvar prazos' }).click()
  await expect(page.getByText('Prazos salvos.')).toBeVisible()
  await page.goto('/hoje')
  await expect(paradas).toContainText('Nenhuma negociação parada.')
  await page.goto('/funil')
  await expect(page.locator('li[draggable]').filter({ hasText: 'Lisboa em março' })).not.toContainText('Negociação parada')
})
