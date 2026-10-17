import { expect, test, type Page } from '@playwright/test'

async function cadastrar(page: Page, rotulo: string) {
  const email = `e2e-${rotulo}-${Date.now()}@teste.dev`
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill(`Pessoa ${rotulo}`)
  await page.getByLabel('Nome da agência').fill(`Agência ${rotulo}`)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
}

test('creates, reopens and edits a client; other agencies cannot open it', async ({ page, browser }) => {
  await cadastrar(page, 'clientes')

  await page.getByRole('link', { name: 'Novo cliente' }).click()
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByText('Digite o nome do cliente.')).toBeVisible()

  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza')
  await page.getByLabel('WhatsApp').fill('(11) 99999-9999')
  await page.getByLabel('E-mail').fill('ana@mail.com')
  await page.getByLabel('Cidade', { exact: true }).fill('Santos')
  await page.getByLabel('Aniversário').fill('1990-05-17')
  await page.getByLabel('Como conheceu a agência').selectOption('instagram')
  await page.getByLabel('Destinos de interesse').fill('Lisboa, Fernando de Noronha')
  await page.getByLabel('Número de pessoas').fill('4')
  await page.getByLabel('Consentimento').selectOption('aceitou')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()

  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/)
  const url = page.url()
  await expect(page.getByRole('heading', { name: 'Ana Souza' })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Ana Souza')
  await expect(page.getByLabel('WhatsApp')).toHaveValue('5511999999999')
  await expect(page.getByLabel('E-mail')).toHaveValue('ana@mail.com')
  await expect(page.getByLabel('Cidade', { exact: true })).toHaveValue('Santos')
  await expect(page.getByLabel('Aniversário')).toHaveValue('1990-05-17')
  await expect(page.getByLabel('Como conheceu a agência')).toHaveValue('instagram')
  await expect(page.getByLabel('Destinos de interesse')).toHaveValue('Lisboa, Fernando de Noronha')
  await expect(page.getByLabel('Número de pessoas')).toHaveValue('4')
  await expect(page.getByLabel('Consentimento')).toHaveValue('aceitou')

  await page.getByLabel('Cidade', { exact: true }).fill('Rio de Janeiro')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Alterações salvas.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Cidade', { exact: true })).toHaveValue('Rio de Janeiro')

  await page.getByLabel('WhatsApp').fill('123')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('WhatsApp inválido')).toBeVisible()

  // Another agency sees "not found" (streamed, so the HTTP status is 200) and none of the data
  const contexto = await browser.newContext({ baseURL: 'http://localhost:3100' })
  const outra = await contexto.newPage()
  await cadastrar(outra, 'outra')
  await outra.goto(url)
  await expect(outra.getByText('could not be found')).toBeVisible()
  await expect(outra.getByText('Ana Souza')).toHaveCount(0)
  await expect(outra.getByLabel('WhatsApp')).toHaveCount(0)
  await contexto.close()
})

test('tags and dated notes on the client sheet', async ({ page }) => {
  await cadastrar(page, 'notas')
  await page.getByRole('link', { name: 'Novo cliente' }).click()
  await page.getByLabel('Nome', { exact: true }).fill('Bia Lima')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Bia Lima' })).toBeVisible()

  // Tags: add, dedupe ignoring case, add another, remove
  await expect(page.getByText('Nenhuma etiqueta ainda')).toBeVisible()
  await page.getByLabel('Adicionar etiqueta').fill('Europa')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByRole('button', { name: 'Remover etiqueta Europa' })).toBeVisible()

  await page.getByLabel('Adicionar etiqueta').fill('  europa ')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByLabel('Adicionar etiqueta')).toHaveValue('') // form remounts after each submit
  await page.getByLabel('Adicionar etiqueta').fill('VIP')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByRole('button', { name: 'Remover etiqueta VIP' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Remover etiqueta Europa/i })).toHaveCount(1)

  await expect(page.getByLabel('Adicionar etiqueta')).toHaveValue('')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await expect(page.getByText('Digite o nome da etiqueta.')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Remover etiqueta Europa' })).toBeVisible()
  await page.getByRole('button', { name: 'Remover etiqueta Europa' }).click()
  await expect(page.getByRole('button', { name: 'Remover etiqueta Europa' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Remover etiqueta VIP' })).toBeVisible()

  // Notes: author and date, newest first, delete
  await expect(page.getByText('Nenhuma anotação ainda.')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar anotação' }).click()
  await expect(page.getByText('Escreva a anotação.')).toBeVisible()

  await page.getByLabel('Nova anotação').fill('Quer viajar em março')
  await page.getByRole('button', { name: 'Salvar anotação' }).click()
  const primeira = page.getByRole('listitem').filter({ hasText: 'Quer viajar em março' })
  await expect(primeira).toContainText('Pessoa notas')
  await expect(primeira).toContainText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)

  await page.getByLabel('Nova anotação').fill('Segunda nota')
  await page.getByRole('button', { name: 'Salvar anotação' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Segunda nota' })).toBeVisible()
  const textos = await page.locator('ol > li p.whitespace-pre-wrap').allTextContents()
  expect(textos).toEqual(['Segunda nota', 'Quer viajar em março'])

  await page.reload()
  await page.getByRole('listitem').filter({ hasText: 'Segunda nota' }).getByRole('button', { name: 'Apagar' }).click()
  await expect(page.getByText('Segunda nota')).toHaveCount(0)
  await expect(page.getByText('Quer viajar em março')).toBeVisible()
})
