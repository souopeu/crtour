import { expect, test } from '@playwright/test'

test('on a phone the top menu folds into "Menu" and closes after navigating', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa menu')
  await page.getByLabel('Nome da agência').fill('Agência menu')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-menu-${Date.now()}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  const funil = page.getByRole('link', { name: 'Funil' })
  await expect(funil).toBeHidden()
  await page.getByText('Menu', { exact: true }).click()
  await expect(funil).toBeVisible()
  await expect(page.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page')
  await funil.click()
  await expect(page.getByRole('heading', { name: 'Funil de vendas' })).toBeVisible()
  await expect(funil).toBeHidden() // closed after navigating

  // Nothing overflows sideways on a phone
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
