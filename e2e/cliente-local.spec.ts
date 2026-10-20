import { expect, test } from '@playwright/test'

test('client form: WhatsApp mask, e-mail check on leaving, country/state/city and the state filter (R124–R126)', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa local')
  await page.getByLabel('Nome da agência').fill('Agência local')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha').fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Pedro Local')

  // R124: letters never get in; the number is formatted while typing; error on leaving the field
  const whats = page.getByRole('textbox', { name: /WhatsApp/ })
  await whats.pressSequentially('asdasd')
  await expect(whats).toHaveValue('')
  await whats.pressSequentially('8399999')
  await expect(whats).toHaveValue('(83) 9999-9')
  await page.getByLabel('Nome', { exact: true }).click()
  await expect(page.getByText('WhatsApp inválido. Use DDD + número, ou +código do país.')).toBeVisible()
  await whats.evaluate((e: HTMLInputElement) => { e.focus(); e.setSelectionRange(e.value.length, e.value.length) }) // caret at the end, as after a click there
  await whats.pressSequentially('0000')
  await expect(whats).toHaveValue('(83) 99999-0000')
  await expect(page.getByText('WhatsApp inválido. Use DDD + número, ou +código do país.')).toHaveCount(0)

  // R125: e-mail checked when leaving the field
  const email = page.getByRole('textbox', { name: 'E-mail', exact: true })
  await email.fill('asdasd')
  await page.getByLabel('Nome', { exact: true }).click()
  await expect(page.getByText('Digite um e-mail válido.')).toBeVisible()
  await email.fill('pedro@exemplo.com')
  await page.getByLabel('Nome', { exact: true }).click()
  await expect(page.getByText('Digite um e-mail válido.')).toHaveCount(0)

  // R126: Brazil by default with the 27 UFs; another country turns the state into free text
  await expect(page.getByRole('textbox', { name: 'País' })).toHaveValue('Brasil')
  await page.getByRole('combobox', { name: 'Estado' }).selectOption('PB')
  await page.getByRole('textbox', { name: 'Cidade', exact: true }).fill('João Pessoa')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Pedro Local' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Estado' })).toHaveValue('PB')
  await expect(whats).toHaveValue('(83) 99999-0000')

  await page.getByRole('textbox', { name: 'País' }).fill('Portugal')
  await page.getByRole('textbox', { name: 'Estado' }).fill('Porto')
  await page.getByRole('textbox', { name: 'Cidade', exact: true }).fill('Porto')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Alterações salvas.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'País' })).toHaveValue('Portugal')
  await expect(page.getByRole('textbox', { name: 'Estado' })).toHaveValue('Porto')

  // List shows city · state, and the state filter works
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Bia Recife')
  await page.getByRole('combobox', { name: 'Estado' }).selectOption('PE')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Bia Recife' })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('table', { name: 'Clientes' })).toContainText('Porto · Porto')
  await page.getByRole('combobox', { name: 'Estado' }).selectOption('PE')
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await expect(page).toHaveURL(/estado=PE/)
  await expect(page.getByRole('table', { name: 'Clientes' }).getByRole('link', { name: 'Bia Recife' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Clientes' }).getByRole('link', { name: 'Pedro Local' })).toHaveCount(0)
})
