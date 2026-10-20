import { expect, test, type Page } from '@playwright/test'

const hojeBr = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)

async function novoCliente(page: Page, nome: string, whatsapp: string, consentimento: string, aniversario: string) {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  await page.getByRole('textbox', { name: /WhatsApp/ }).fill(whatsapp)
  await page.getByLabel('Aniversário').fill(aniversario)
  await page.getByLabel('Consentimento').selectOption(consentimento)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
  return page.url()
}

test('birthday messages on Today: own template, consent only, once a year (R71)', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa aniversário')
  await page.getByLabel('Nome da agência').fill('Agência aniversário')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-aniv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/configuracoes')
  const form = page.getByRole('form', { name: 'Mensagens do passeio' })
  await expect(form.getByLabel('Mensagem de 1 ano da viagem')).toBeVisible()
  await form.getByLabel('Mensagem de aniversário').fill('Parabéns, {nome}! Um abraço da agência.')
  await form.getByRole('button', { name: 'Salvar mensagens' }).click()
  await expect(form.getByText('Mensagens salvas.')).toBeVisible()

  const aniversario = `1990-${hojeBr().slice(5)}`
  const urlAna = await novoCliente(page, 'Ana Souza', '(11) 99999-0001', 'aceitou', aniversario)
  await novoCliente(page, 'Bia Lima', '(11) 99999-0002', 'nao_informado', aniversario)

  await page.goto('/hoje')
  const fila = page.getByRole('region', { name: /Aniversários/ })
  await expect(fila.getByRole('heading')).toHaveText('Aniversários (1)')
  const ana = fila.getByRole('listitem').filter({ hasText: 'Ana Souza' })
  await expect(ana).toContainText('Parabéns, Ana! Um abraço da agência.')
  await expect(fila).not.toContainText('Bia Lima') // no consent: relationship messages are never queued

  await ana.getByRole('link', { name: 'Enviar aniversário para Ana Souza no WhatsApp' }).click()
  await ana.getByRole('button', { name: 'Registrar envio' }).click()
  await expect(fila.getByRole('heading')).toHaveText('Aniversários (0)')
  await page.goto(urlAna)
  await expect(page.getByRole('region', { name: 'Linha do tempo' })).toContainText('Aniversário: Parabéns, Ana!')
})
