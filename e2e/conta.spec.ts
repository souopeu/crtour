import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const senha = 'senha1234'

async function cadastrar(page: Page, rotulo: string) {
  const email = `e2e-${rotulo}-${Date.now()}@teste.dev`
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill(`Pessoa ${rotulo}`)
  await page.getByLabel('Nome da agência').fill(`Agência ${rotulo}`)
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
  return email
}

async function novoCliente(page: Page, nome: string, whatsapp: string) {
  await page.goto('/clientes/novo')
  await expect(page.getByRole('heading', { name: 'Novo cliente' })).toBeVisible()
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  await page.getByRole('textbox', { name: /WhatsApp/ }).fill(whatsapp)
  await page.getByLabel('Como conheceu a agência').selectOption('instagram')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
}

test('export: CSV with the data, formulas neutralized, notes file, login required', async ({ page, request }) => {
  await cadastrar(page, 'export')
  await novoCliente(page, 'Ana Souza', '(11) 99999-0001')
  await page.getByLabel('Nova anotação').fill('=HYPERLINK("http://evil")')
  await page.getByRole('button', { name: 'Salvar anotação' }).click()
  await expect(page.getByRole('region', { name: 'Anotações' }).getByText('=HYPERLINK')).toBeVisible()
  await novoCliente(page, '=1+1', '(21) 98888-0002')

  await page.goto('/configuracoes')
  const clientes = page.waitForEvent('download')
  await page.getByRole('link', { name: /Baixar clientes/ }).click()
  const arqClientes = await clientes
  expect(arqClientes.suggestedFilename()).toMatch(/^clientes-crtour-\d{4}-\d{2}-\d{2}\.csv$/)
  const csv = readFileSync((await arqClientes.path())!, 'utf8')
  expect(csv.startsWith('﻿Nome*;WhatsApp;')).toBe(true)
  expect(csv).toContain('Ana Souza;5511999990001')
  expect(csv).toContain("'=1+1;5521988880002") // formula neutralized
  expect(csv).toContain('Instagram')
  expect(csv).not.toMatch(/(^|;|\n)=1\+1/)

  const notas = page.waitForEvent('download')
  await page.getByRole('link', { name: /Baixar anotações/ }).click()
  const csvNotas = readFileSync((await (await notas).path())!, 'utf8')
  expect(csvNotas).toContain('Cliente;Autor;Data;Anotação')
  expect(csvNotas).toContain("Ana Souza;Pessoa export;")
  expect(csvNotas).toContain(`"'=HYPERLINK(""http://evil"")"`)

  // Without a session the endpoint is closed
  const anonimo = await request.get(`${test.info().project.use.baseURL}/exportar?tipo=clientes`, { maxRedirects: 0 })
  expect([307, 308, 401]).toContain(anonimo.status())
})

test('delete account: confirmation word, password check, data gone, login impossible', async ({ page }) => {
  const email = await cadastrar(page, 'excluir')
  await novoCliente(page, 'Cliente Some', '(11) 99999-0003')

  await page.goto('/configuracoes')
  const excluir = page.getByRole('button', { name: 'Excluir conta e todos os dados' })

  await page.getByLabel('Sua senha').fill(senha)
  await excluir.click()
  await expect(page.getByText('Digite EXCLUIR para confirmar.')).toBeVisible()

  await page.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR')
  await page.getByLabel('Sua senha').fill('senha-errada1')
  await excluir.click()
  await expect(page.getByText('Senha incorreta.')).toBeVisible()
  await page.goto('/')
  await expect(page.getByText('Cliente Some')).toBeVisible() // nothing was deleted

  await page.goto('/configuracoes')
  await page.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR')
  await page.getByLabel('Sua senha').fill(senha)
  await excluir.click()
  await expect(page).toHaveURL(/\/login\?conta=excluida/)
  await expect(page.getByText('Sua conta e todos os dados foram excluídos.')).toBeVisible()

  // The login no longer exists
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})
