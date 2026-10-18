import { expect, test } from '@playwright/test'
import { criarVendedora, ligarWhatsappFalso, receberWhatsapp } from './banco'

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
