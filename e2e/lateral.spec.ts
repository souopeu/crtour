import { expect, test } from '@playwright/test'

test('desktop sidebar: groups, active entry, collapse remembered after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa lateral')
  await page.getByLabel('Nome da agência').fill('Agência lateral')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-lateral-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  const menu = page.getByRole('navigation', { name: 'Principal' })
  const lateral = page.locator('aside')

  // Groups and entries, in the order of the spec (R133)
  for (const titulo of ['Vendas', 'Catálogo', 'Operação', 'Gestão']) await expect(menu.getByRole('button', { name: titulo, exact: true })).toBeVisible()
  for (const nome of ['Hoje', 'Calendário', 'Reservas', 'Funil', 'Clientes', 'Remarketing', 'Passeios', 'Fornecedores', 'Veículos', 'Financeiro', 'Painel', 'Avisos', 'Configurações']) {
    await expect(menu.getByRole('link', { name: nome })).toBeVisible()
  }
  await expect(menu.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page')
  const largura = async () => (await lateral.boundingBox())!.width
  expect(await largura()).toBeGreaterThan(200)

  // Navigating moves the active mark
  await menu.getByRole('link', { name: 'Fornecedores' }).click()
  await expect(page).toHaveURL('/fornecedores')
  await expect(menu.getByRole('link', { name: 'Fornecedores' })).toHaveAttribute('aria-current', 'page')
  await expect(menu.getByRole('link', { name: 'Clientes' })).not.toHaveAttribute('aria-current', 'page')

  // R133: a closed group stays closed after a reload, but the group of the current screen always opens
  const vendas = menu.getByRole('button', { name: 'Vendas', exact: true })
  await vendas.click()
  await expect(vendas).toHaveAttribute('aria-expanded', 'false')
  await expect(menu.getByRole('link', { name: 'Funil' })).toBeHidden()
  await page.reload()
  await expect(menu.getByRole('link', { name: 'Funil' })).toBeHidden()
  await page.goto('/funil')
  await expect(menu.getByRole('link', { name: 'Funil' })).toHaveAttribute('aria-current', 'page')
  await expect(vendas).toHaveAttribute('aria-expanded', 'true')
  await page.goto('/fornecedores')
  await expect(menu.getByRole('link', { name: 'Funil' })).toBeHidden()
  await vendas.click()
  await expect(menu.getByRole('link', { name: 'Funil' })).toBeVisible()

  // Collapse: only icons stay, names stay available to screen readers, and the choice survives a reload
  await page.getByRole('button', { name: 'Recolher menu' }).click()
  await expect(menu.getByText('Vendas', { exact: true })).toBeHidden()
  await expect(menu.getByRole('link', { name: 'Funil' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Financeiro' })).toBeVisible() // icons only: every group shows
  await expect.poll(largura).toBeLessThan(100) // the width animates
  await page.reload()
  await expect(page.getByRole('button', { name: 'Expandir menu' })).toHaveAttribute('aria-expanded', 'false')
  expect(await largura()).toBeLessThan(100) // rendered collapsed by the server, no animation on load
  await page.getByRole('button', { name: 'Expandir menu' }).click()
  await expect(menu.getByText('Vendas', { exact: true })).toBeVisible()

  // Nothing overflows sideways
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // The sidebar is not printed
  await page.emulateMedia({ media: 'print' })
  await expect(lateral).toBeHidden()
})
