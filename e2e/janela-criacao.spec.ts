import { expect, test } from '@playwright/test'

test('"Novo …" opens a side window over the screen; Esc and Cancelar close it; a new client goes back to the new deal (R122, R123)', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa janela')
  await page.getByLabel('Nome da agência').fill('Agência janela')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-janela-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha').fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  // Client: the window opens over the list; Esc closes it and the list is still there
  await page.getByRole('link', { name: 'Novo cliente' }).click()
  const janela = page.getByRole('dialog', { name: 'Novo cliente' })
  await expect(janela).toBeVisible()
  await expect(page).toHaveURL('/clientes/novo')
  await expect(janela.getByRole('textbox', { name: 'Nome', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(janela).toHaveCount(0)
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible()

  // Cancelar closes too
  await page.getByRole('link', { name: 'Novo cliente' }).click()
  await page.getByRole('dialog', { name: 'Novo cliente' }).getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Opening the address directly shows the full page, not a window
  await page.goto('/clientes/novo')
  await expect(page.getByRole('heading', { name: 'Novo cliente', level: 1 })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Deal: search, "+ Novo cliente" inside the window, back to the deal with the client chosen
  await page.goto('/funil')
  await page.getByRole('link', { name: 'Nova negociação' }).click()
  const neg = page.getByRole('dialog', { name: 'Nova negociação' })
  await expect(neg).toBeVisible()
  await neg.getByRole('searchbox', { name: /Para qual cliente/ }).fill('ninguém')
  await neg.getByRole('button', { name: 'Buscar' }).click()
  await expect(neg.getByText('Nenhum cliente encontrado.')).toBeVisible()
  await neg.getByRole('link', { name: '+ Novo cliente' }).click()
  const cli = page.getByRole('dialog', { name: 'Novo cliente' })
  await expect(cli).toBeVisible()
  await cli.getByRole('textbox', { name: 'Nome', exact: true }).fill('Júlia Janela')
  await cli.getByRole('button', { name: 'Salvar cliente' }).click()

  const neg2 = page.getByRole('dialog', { name: 'Nova negociação' })
  await expect(neg2.getByText(/Negociação para Júlia Janela/)).toBeVisible()
  // R123: stage arrows set the initial stage (the select follows)
  await neg2.getByRole('group', { name: 'Etapa inicial' }).getByRole('button', { name: 'Orçamento' }).click()
  await expect(neg2.getByRole('button', { name: '✓ Orçamento' })).toHaveAttribute('aria-pressed', 'true')
  await expect(neg2.getByRole('combobox', { name: 'Etapa' })).toHaveValue('orcamento')
  await neg2.getByRole('textbox', { name: 'Título' }).fill('Gramado em julho')
  await neg2.getByRole('button', { name: 'Criar negociação' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Gramado em julho' })).toBeVisible()
  await expect(page.getByText('Orçamento').first()).toBeVisible()
})
