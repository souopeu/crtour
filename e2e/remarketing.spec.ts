import { expect, test, type Page } from '@playwright/test'

async function cadastrar(page: Page) {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa remarketing')
  await page.getByLabel('Nome da agência').fill('Agência remarketing')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-remarketing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('link', { name: 'Remarketing' })).toBeVisible()
}

async function novoCliente(page: Page, nome: string, whatsapp: string, consentimento: string, destinos: string) {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  if (whatsapp) await page.getByRole('textbox', { name: /WhatsApp/ }).fill(whatsapp)
  await page.getByLabel('Consentimento').selectOption(consentimento)
  await page.getByLabel('Destinos de interesse').fill(destinos)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
  return page.url()
}

test('remarketing: segment, consent-only queue, send becomes activity, rounds, template', async ({ page, context }) => {
  await cadastrar(page)
  const fichaAna = await novoCliente(page, 'Ana Souza', '(11) 99999-0001', 'aceitou', 'Lisboa, Porto')
  await novoCliente(page, 'Bia Lima', '(11) 99999-0002', 'nao_informado', 'Lisboa')
  await novoCliente(page, 'Caio Saiu', '(11) 99999-0003', 'pediu_saida', 'lisboa')
  await novoCliente(page, 'Eva Sem Número', '', 'aceitou', 'Lisboa')
  await novoCliente(page, 'Duda Rocha', '(11) 99999-0005', 'aceitou', 'Cancún')

  await page.goto('/remarketing')
  await expect(page.getByText('Nenhum segmento ainda.')).toBeVisible()
  await page.getByRole('link', { name: 'Novo segmento' }).click()

  // Filtering shows the count and the list
  await page.getByLabel('Destino de interesse').fill('lisboa')
  await page.getByRole('button', { name: 'Ver clientes' }).click()
  const previa = page.getByRole('region', { name: /clientes?$/ })
  await expect(previa.getByRole('heading')).toHaveText('4 clientes')
  await expect(previa).toContainText('Destino de interesse: lisboa · 2 com consentimento para mensagens')
  await expect(previa).not.toContainText('Duda Rocha')

  // Save with a name (validation first)
  await page.getByRole('button', { name: 'Salvar segmento' }).click()
  await expect(page.getByText('Dê um nome ao segmento.')).toBeVisible()
  await page.getByLabel('Nome do segmento').fill('Lisboa 2027')
  await page.getByRole('button', { name: 'Salvar segmento' }).click()
  await expect(page.getByRole('heading', { name: 'Lisboa 2027', level: 1 })).toBeVisible()
  const urlSegmento = page.url()

  // R127: tabs with counters; only consent "aceitou" with a number gets a button; the rest are apart, without one
  const abas = page.getByRole('navigation', { name: 'Fila do segmento' })
  const chamar = page.getByRole('region', { name: /Para chamar/ })
  const chamados = page.getByRole('region', { name: /Já chamados/ })
  const fora = page.getByRole('region', { name: /Sem permissão/ })
  await expect(abas).toContainText('Para chamar (1)')
  await expect(abas).toContainText('Já chamados (0)')
  await expect(abas).toContainText('Sem permissão (3)')
  await expect(chamar.getByRole('heading')).toHaveText('Para chamar (1)')
  await expect(chamar.getByRole('table')).toContainText('Olá, Ana! Tudo bem? Temos novidades de Lisboa para você.')
  await expect(page.getByRole('link', { name: /^Chamar (Bia|Caio|Eva)/ })).toHaveCount(0)
  await abas.getByRole('link', { name: 'Sem permissão (3)' }).click()
  await expect(fora).toContainText('Bia Lima')
  await expect(fora).toContainText('Consentimento não informado')
  await expect(fora).toContainText('Pediu para sair')
  await expect(fora).toContainText('Sem WhatsApp cadastrado')
  await abas.getByRole('link', { name: 'Para chamar (1)' }).click()

  // Send: WhatsApp, then register
  await context.route('https://wa.me/**', (rota) => rota.fulfill({ status: 200, contentType: 'text/html', body: '<p>wa.me</p>' }))
  const aba = context.waitForEvent('page')
  await chamar.getByRole('link', { name: 'Chamar Ana Souza no WhatsApp' }).click()
  expect((await aba).url()).toContain('Temos%20novidades%20de%20Lisboa')
  await chamar.getByRole('button', { name: 'Registrar envio' }).click()
  await expect(chamar).toContainText('Ninguém para chamar nesta rodada.')
  await abas.getByRole('link', { name: 'Já chamados (1)' }).click()
  await expect(chamados.getByRole('heading')).toHaveText('Já chamados nesta rodada (1)')
  await expect(chamados).toContainText('Ana Souza')

  // The send is a done activity and the last interaction on the client sheet
  await page.goto(fichaAna)
  await expect(page.getByText(/Última interação: .* \(hoje\)/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Linha do tempo' })).toContainText('Remarketing (Lisboa 2027): Olá, Ana!')

  // Reopening gives the same result; a new round allows calling again
  await page.goto(`${urlSegmento}?aba=chamados`)
  await expect(chamados).toContainText('Ana Souza')
  await page.getByRole('button', { name: /Começar nova rodada/ }).click()
  await expect(abas).toContainText('Já chamados (0)')
  await abas.getByRole('link', { name: 'Para chamar (1)' }).click()
  await expect(chamar.getByRole('heading')).toHaveText('Para chamar (1)')
  await expect(page.getByText(/rodada 2/)).toBeVisible()

  // Editing the template
  await page.getByText('Editar nome e mensagem').click()
  await page.getByLabel('Mensagem modelo').fill('Oi {nome}, bora para {destino}?')
  await page.getByRole('button', { name: 'Salvar mensagem' }).click()
  await expect(page.getByText('Mensagem salva.')).toBeVisible()
  await expect(chamar).toContainText('Oi Ana, bora para Lisboa?')

  // Names are unique per agency (ignoring case)
  await page.goto('/remarketing/novo?aniversarioMes=3')
  await page.getByLabel('Nome do segmento').fill('lisboa 2027')
  await page.getByRole('button', { name: 'Salvar segmento' }).click()
  await expect(page.getByText('Já existe um segmento com esse nome.')).toBeVisible()

  await page.goto('/remarketing')
  await expect(page.getByRole('link', { name: 'Lisboa 2027' })).toBeVisible()
  await expect(page.getByText(/Destino de interesse: lisboa · rodada 2/)).toBeVisible()

  // Delete
  await page.goto(urlSegmento)
  await page.getByRole('button', { name: 'Apagar segmento' }).click()
  await page.getByRole('button', { name: 'Apagar mesmo' }).click()
  await expect(page.getByText('Nenhum segmento ainda.')).toBeVisible()
})
