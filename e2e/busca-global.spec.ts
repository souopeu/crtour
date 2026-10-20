import { expect, test } from '@playwright/test'

test('global search: "/" opens it from any screen, results are grouped and open the record (R76, R77)', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa busca')
  await page.getByLabel('Nome da agência').fill('Agência busca')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-busca-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  // "/" typed inside a form field stays in the field
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('')
  await page.getByLabel('Nome', { exact: true }).pressSequentially('Ana/Souza')
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Ana/Souza')
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Souza' })).toBeVisible()
  const ficha = page.url()

  // From another screen, "/" focuses the search; results are announced and grouped
  await page.goto('/funil')
  await page.getByRole('heading', { name: 'Funil de vendas' }).click()
  const busca = page.getByRole('combobox', { name: 'Buscar no crTOUR' })
  // The shortcut listener is attached on hydration; retry the key until the page is interactive.
  await expect(async () => {
    await page.keyboard.press('/')
    await expect(busca).toBeFocused({ timeout: 500 })
  }).toPass()
  await page.keyboard.type('ana sou')
  const lista = page.getByRole('listbox', { name: 'Resultados da busca' })
  await expect(lista.getByRole('option', { name: /Ana Souza/ })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('1 resultado')

  // Tab reaches "see all" (the panel stays open), Shift+Tab comes back
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Ver todos em Clientes' })).toBeFocused()
  await expect(page.getByRole('link', { name: 'Ver todos em Clientes' })).toHaveAttribute('href', '/?q=ana+sou')
  await page.keyboard.press('Shift+Tab')
  await expect(busca).toBeFocused()

  // Keyboard: arrow + Enter opens the client; Esc closes
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(ficha)

  await page.keyboard.press('/')
  await page.keyboard.type('zzz')
  await expect(page.getByRole('status')).toContainText('Nada encontrado')
  await page.keyboard.press('Escape')
  await expect(lista).toHaveCount(0)
})

test('global search on a phone: icon in the header, no horizontal page scroll (R76)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa celular')
  await page.getByLabel('Nome da agência').fill('Agência celular')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-busca-cel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Bruno Lima')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Bruno Lima' })).toBeVisible()

  await page.goto('/funil')
  await page.getByLabel('Buscar', { exact: true }).click()
  const busca = page.getByRole('combobox', { name: 'Buscar no crTOUR' })
  await expect(busca).toBeFocused()
  await busca.fill('bruno')
  await expect(page.getByRole('option', { name: /Bruno Lima/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
