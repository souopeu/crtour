import { expect, test } from '@playwright/test'

const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`
const senha = 'senha1234'

test('anonymous user is sent to login, keeping the destination', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login\?next=%2F$/)
})

test('signup, logout, login and wrong password', async ({ page }) => {
  await page.goto('/cadastro')

  // Terms must be accepted
  await page.getByLabel('Seu nome').fill('Pessoa E2E')
  await page.getByLabel('Nome da agência').fill('Agência E2E')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('aceite os termos')).toBeVisible()

  // The form resets after a failed submit; passwords are never echoed back.
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()

  // Logged users don't see the login page
  await page.goto('/login')
  await expect(page).toHaveURL('/')

  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)

  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha').fill('errada1234')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()

  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL('/')
})

test('login ignores an external next parameter', async ({ page }) => {
  await page.goto('/login?next=https://evil.com')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL('/')
})
