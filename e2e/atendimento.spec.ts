import { createHmac } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { atualizar, conversaDoNumero, criarVendedora, diasAtras, ligarWhatsappFalso, receberWhatsapp } from './banco'

// Spec 19, Fatia 2b (R102–R104, R107): the inbox with a fake provider, no sending yet.
test('atendimento: hidden without WhatsApp; a message lands in Novos, is read, taken, handed over and archived', async ({ page }) => {
  const agencia = `Agência atendimento ${Date.now()}`
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pedro Dono')
  await page.getByLabel('Nome da agência').fill(agencia)
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-atend-${Date.now()}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('link', { name: 'Painel' })).toBeVisible()

  // R107: no number, no menu entry; the address explains
  await expect(page.getByRole('link', { name: /^Atendimento/ })).toHaveCount(0)
  await page.goto('/atendimento')
  await expect(page.getByRole('heading', { name: 'WhatsApp ainda não conectado' })).toBeVisible()

  const conta = await ligarWhatsappFalso(agencia)
  await criarVendedora(agencia, 'Leila Vendas')
  const n = String(Date.now()).slice(-8)
  await receberWhatsapp(conta, `w1-${n}`, `5511${n}`, 'Lucas Pereira', 'Oi! Quero saber do passeio para Gramado')
  await receberWhatsapp(conta, `w2-${n}`, `5511${n}`, 'Lucas Pereira', 'Tem vaga em dezembro?')

  // R102, R103: the conversation is new, with its unread count, in the menu and in the tab
  await page.goto('/atendimento')
  await expect(page.getByRole('link', { name: /^Atendimento/ }).first()).toContainText('1')
  const filas = page.getByRole('navigation', { name: 'Filas de atendimento' })
  await expect(filas.getByRole('link', { name: /Novos/ })).toContainText('1 com mensagens não lidas')
  const item = page.getByRole('list', { name: 'Conversas' }).getByRole('link', { name: /Lucas Pereira/ })
  await expect(item).toContainText('Tem vaga em dezembro?')
  await expect(item).toContainText('2 não lidas')

  // Search by name and by phone
  await page.getByLabel('Nome ou telefone').fill('lucas')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(item).toBeVisible()
  await page.getByLabel('Nome ou telefone').fill('não existe')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByText('Nenhuma conversa com esse filtro.')).toBeVisible()
  await page.goto('/atendimento')

  // R104: opening shows the whole history and clears the unread count
  await item.click()
  const conversa = page.getByRole('region', { name: 'Lucas Pereira' })
  await expect(conversa.getByRole('list', { name: 'Mensagens e eventos' })).toContainText('Oi! Quero saber do passeio para Gramado')
  await expect(conversa).toContainText('Ninguém assumiu ainda')
  await page.reload()
  await expect(page.getByRole('list', { name: 'Conversas' }).getByRole('link', { name: /Lucas Pereira/ })).not.toContainText('não lidas')

  // Take it: it moves to Meus and the timeline says so
  await conversa.getByRole('button', { name: 'Assumir' }).click()
  await expect(page.getByText('Agora o atendimento é seu.')).toBeVisible()
  await expect(conversa).toContainText('Com Pedro Dono')
  await expect(conversa).toContainText('Pedro Dono assumiu o atendimento')
  await filas.getByRole('link', { name: /Meus/ }).click()
  await expect(page.getByRole('list', { name: 'Conversas' })).toContainText('Lucas Pereira')

  // Hand it over to the seller: the owner still sees it, in Outros
  await page.getByRole('list', { name: 'Conversas' }).getByRole('link', { name: /Lucas Pereira/ }).click()
  await conversa.getByLabel('Passar para').selectOption({ label: 'Leila Vendas' })
  await conversa.getByRole('button', { name: 'Transferir' }).click()
  await expect(page.getByText('Atendimento passado para Leila Vendas.')).toBeVisible()
  await expect(conversa).toContainText('Pedro Dono passou o atendimento para Leila Vendas')
  await filas.getByRole('link', { name: /Outros/ }).click()
  await expect(page.getByRole('list', { name: 'Conversas' })).toContainText('Leila Vendas')

  // Archive it; a new message brings it back
  await page.getByRole('list', { name: 'Conversas' }).getByRole('link', { name: /Lucas Pereira/ }).click()
  await conversa.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByText(/Conversa arquivada/)).toBeVisible()
  await filas.getByRole('link', { name: /Arquivadas/ }).click()
  await expect(page.getByRole('list', { name: 'Conversas' })).toContainText('Lucas Pereira')
  await receberWhatsapp(conta, `w3-${n}`, `5511${n}`, 'Lucas Pereira', 'Voltei!')
  await page.goto('/atendimento?aba=outros')
  await expect(page.getByRole('list', { name: 'Conversas' })).toContainText('Voltei!')
})

// Spec 19, Fatia 2c (R105, R106): reply through the (fake) provider, new messages without reloading, 24 h window and consent.
test('atendimento: reply, provider failure, live update, 24 h window and opt-out', async ({ page }) => {
  const agencia = `Agência resposta ${Date.now()}`
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pedro Dono')
  await page.getByLabel('Nome da agência').fill(agencia)
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-resp-${Date.now()}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('link', { name: 'Painel' })).toBeVisible()
  const conta = await ligarWhatsappFalso(agencia)
  const n = String(Date.now()).slice(-8)
  const numero = `5511${n}`
  await receberWhatsapp(conta, `r1-${n}`, numero, 'Marina Alves', 'Bom dia! Ainda tem vaga para Bonito?')
  const { id, clienteId } = await conversaDoNumero(numero)

  await page.goto(`/atendimento?c=${id}`)
  const conversa = page.getByRole('region', { name: 'Marina Alves' })
  const historico = conversa.getByRole('list', { name: 'Mensagens e eventos' })

  // R105: inside the 24 h window a reply goes out and shows as sent
  await conversa.getByLabel('Responder').fill('Tem sim! Posso te mandar o roteiro?')
  await conversa.getByRole('button', { name: 'Enviar' }).click()
  await expect(conversa.getByText('Mensagem enviada.')).toBeVisible()
  await expect(historico).toContainText('Tem sim! Posso te mandar o roteiro?')
  await expect(historico).toContainText('✓ enviada')
  await expect(conversa.getByLabel('Responder')).toHaveValue('')

  // A provider failure keeps the text to try again
  await conversa.getByLabel('Responder').fill('Mensagem que vai [falha]')
  await conversa.getByRole('button', { name: 'Enviar' }).click()
  await expect(conversa.getByText(/Não foi possível enviar/)).toBeVisible()
  await expect(conversa.getByLabel('Responder')).toHaveValue('Mensagem que vai [falha]')

  // R106: a new message shows up on the open screen without reloading
  await receberWhatsapp(conta, `r2-${n}`, numero, 'Marina Alves', 'Pode sim, obrigada!')
  await expect(historico).toContainText('Pode sim, obrigada!', { timeout: 20_000 })

  // The window is checked by the server, not only by the screen: the field is still there, the send is refused
  await atualizar('conversas', id, { ultima_recebida_em: diasAtras(2) })
  await conversa.getByLabel('Responder').fill('Oi de novo')
  await conversa.getByRole('button', { name: 'Enviar' }).click()
  await expect(conversa.getByText(/Passou de 24 h desde a última mensagem do cliente/)).toBeVisible()
  await page.reload()
  await expect(conversa.getByText(/Passou de 24 h desde a última mensagem do cliente/)).toBeVisible()
  await expect(conversa.getByLabel('Responder')).toHaveCount(0)

  // Who asked to leave never receives
  await atualizar('conversas', id, { ultima_recebida_em: new Date().toISOString() })
  await atualizar('clientes', clienteId, { consentimento_whatsapp: 'pediu_saida' })
  await page.reload()
  await expect(conversa.getByText('Este cliente pediu para não receber mensagens.')).toBeVisible()
  await expect(conversa.getByLabel('Responder')).toHaveCount(0)
})

// Spec 21 (W1): official WhatsApp in coexistence, read only. Notices signed with the app secret, as Meta sends them.
test('atendimento: official notices (message from an ad, echo from the phone, history) in read-only mode', async ({ page, request }) => {
  const SEGREDO = 'segredo-e2e-local' // same test-only secret as playwright.config.ts
  const agencia = `Agência oficial ${Date.now()}`
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pedro Dono')
  await page.getByLabel('Nome da agência').fill(agencia)
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-oficial-${Date.now()}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('link', { name: 'Painel' })).toBeVisible()
  const conta = await ligarWhatsappFalso(agencia, { provedor: 'meta' })
  const n = String(Date.now()).slice(-8)
  const cliente = `5511${n}`
  const agora = Math.floor(Date.now() / 1000)

  // R111: Meta's one-time check, only for our token
  expect((await request.get('/api/whatsapp/aviso/meta?hub.mode=subscribe&hub.verify_token=token-e2e-local&hub.challenge=4242')).status()).toBe(200)
  expect((await request.get('/api/whatsapp/aviso/meta?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=4242')).status()).toBe(403)

  const metadata = { display_phone_number: '5511900000000', phone_number_id: conta }
  const enviar = (field: string, value: object, segredo = SEGREDO) => {
    const corpo = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field, value: { messaging_product: 'whatsapp', metadata, ...value } }] }] })
    const assinatura = `sha256=${createHmac('sha256', segredo).update(corpo).digest('hex')}`
    return request.post('/api/whatsapp/aviso/meta', { data: corpo, headers: { 'content-type': 'application/json', 'x-hub-signature-256': assinatura } })
  }

  // A forged notice is refused and stores nothing
  expect((await enviar('messages', { messages: [{ from: cliente, id: `wamid.F${n}`, timestamp: String(agora), type: 'text', text: { body: 'falso' } }] }, 'outro')).status()).toBe(401)

  // R113: history first (180 days), then a message from an ad, then the agency's answer from the phone (R112)
  expect((await enviar('history', { history: [{ metadata: { phase: 0, chunk_order: 1, progress: 100 }, threads: [{ id: cliente, messages: [
    { from: cliente, id: `wamid.H1${n}`, timestamp: String(agora - 30 * 86_400), type: 'text', text: { body: 'Vocês fazem Bonito?' }, history_context: { status: 'READ' } },
    { from: '5511900000000', id: `wamid.H2${n}`, timestamp: String(agora - 30 * 86_400 + 60), type: 'text', text: { body: 'Fazemos sim, em março' }, history_context: { status: 'READ' } },
  ] }] }] })).status()).toBe(200)
  expect((await enviar('messages', {
    contacts: [{ profile: { name: 'Júlia Prado' }, wa_id: cliente }],
    messages: [{ from: cliente, id: `wamid.M${n}`, timestamp: String(agora - 60), type: 'text', text: { body: 'Vi o anúncio de Gramado!' },
      referral: { source_url: 'https://fb.me/x', source_id: '120200', source_type: 'ad', headline: 'Gramado no inverno', ctwa_clid: `CLID${n}` } }],
  })).status()).toBe(200)
  expect((await enviar('smb_message_echoes', { message_echoes: [{ from: '5511900000000', to: cliente, id: `wamid.E${n}`, timestamp: String(agora), type: 'text', text: { body: 'Oi Júlia! Te mando o roteiro.' } }] })).status()).toBe(200)

  await page.goto('/atendimento')
  await page.getByRole('list', { name: 'Conversas' }).getByRole('link', { name: /Contato do WhatsApp|Júlia/ }).click()
  const historico = page.getByRole('list', { name: 'Mensagens e eventos' })
  await expect(historico).toContainText('Vocês fazem Bonito?')
  await expect(historico).toContainText('Vi o anúncio de Gramado!')
  await expect(historico).toContainText('Chegou pelo anúncio "Gramado no inverno"')
  await expect(historico.getByRole('listitem').filter({ hasText: 'Oi Júlia! Te mando o roteiro.' }).last()).toContainText('pelo celular')
  // R114: read only, the reply box is replaced by the explanation
  await expect(page.getByText('Responda pelo WhatsApp do celular. A resposta aparece aqui em alguns segundos.')).toBeVisible()
  await expect(page.getByLabel('Responder')).toHaveCount(0)
})
