import { expect, test, type Page } from '@playwright/test'

async function novoCliente(page: Page, nome: string, consentimento?: string) {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  if (consentimento) await page.getByLabel('Consentimento').selectOption(consentimento)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
}

test('clients: table and cards views, toolbar filters kept across views (R60, R61)', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa visões')
  await page.getByLabel('Nome da agência').fill('Agência visões')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-visoes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByText(/Você ainda não tem clientes/)).toBeVisible()

  await novoCliente(page, 'Ana Souza', 'aceitou')
  await novoCliente(page, 'Beto Lima')
  await page.goto('/')

  // Table is the default view, with the consent as a labelled status block and a summary row
  const visoes = page.getByRole('navigation', { name: 'Visões dos clientes' })
  await expect(visoes.getByRole('link', { name: 'Tabela' })).toHaveAttribute('aria-current', 'page')
  const tabela = page.getByRole('table', { name: 'Clientes' })
  await expect(tabela.getByRole('row', { name: /Ana Souza/ })).toContainText('Aceitou mensagens')
  await expect(tabela.getByRole('row', { name: /^Total/ })).toContainText('2 clientes')
  await expect(page.getByRole('link', { name: '+ Adicionar cliente' })).toBeVisible()

  // The search survives switching to cards and back
  await page.getByLabel('Buscar por nome, e-mail ou telefone').fill('ana')
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await expect(tabela.getByRole('row', { name: /Beto Lima/ })).toHaveCount(0)
  await visoes.getByRole('link', { name: 'Cartões' }).click()
  await expect(page).toHaveURL(/q=ana.*visao=cartoes/)
  await expect(page.getByRole('table', { name: 'Clientes' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Ana Souza/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Beto Lima/ })).toHaveCount(0)
  await visoes.getByRole('link', { name: 'Tabela' }).click()
  await expect(page).toHaveURL(/q=ana/)
  await expect(page.getByLabel('Buscar por nome, e-mail ou telefone')).toHaveValue('ana')

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
