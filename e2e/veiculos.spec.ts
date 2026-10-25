import { expect, test } from '@playwright/test'

// E9-2 (R137–R138): vehicles, and vehicle + time on a departure (capacity suggested, never above the seats).
test('vehicles and the departure vehicle', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa veículos')
  await page.getByLabel('Nome da agência').fill('Agência veículos')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-veiculos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  // The Operação group reaches Veículos
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Veículos' }).click()
  await expect(page.getByRole('heading', { name: 'Veículos', level: 1 })).toBeVisible()
  await expect(page.getByText('Nenhum veículo ainda.')).toBeVisible()

  // Register: validation, then success
  const novo = page.getByRole('form', { name: 'Cadastrar veículo' })
  await novo.getByLabel('Nome').fill('Van 01')
  await novo.getByLabel('Lugares').fill('0')
  await novo.getByRole('button', { name: 'Cadastrar veículo' }).click()
  await expect(novo.getByText(/entre 1 e 500/)).toBeVisible()
  await novo.getByLabel('Nome').fill('Van 01')
  await novo.getByLabel('Lugares').fill('15')
  await novo.getByRole('button', { name: 'Cadastrar veículo' }).click()
  await expect(page.getByText('Veículo cadastrado.')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Veículos' }).getByRole('row', { name: /Van 01/ })).toContainText('15')

  // A departure with the van: seats suggested as capacity, time kept
  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Litoral sul')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Litoral sul', level: 1 })).toBeVisible()
  await page.getByLabel('Data da saída').fill('2027-08-20')
  await page.getByLabel('Horário (opcional)').fill('08:00')
  await page.getByLabel('Veículo (opcional)').selectOption({ label: 'Van 01 · 15 lugares' })
  await expect(page.getByLabel('Vagas (capacidade)')).toHaveValue('15')
  await expect(page.getByText('No máximo 15, os lugares do veículo.')).toBeVisible()
  await page.getByLabel('Preço por pessoa (R$)').fill('120,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await expect(page.getByText('Saída criada.')).toBeVisible()
  await expect(page.getByRole('link', { name: /20\/08\/2027 · 08:00 · Van 01/ })).toBeVisible()

  // On the departure page; a vehicle in use cannot shrink below it, nor be deleted
  await page.getByRole('link', { name: /20\/08\/2027/ }).click()
  await expect(page.getByText('Horário: 08:00')).toBeVisible()
  await page.getByRole('link', { name: 'Van 01' }).click()
  await expect(page.getByRole('heading', { name: 'Van 01', level: 1 })).toBeVisible()
  await page.getByLabel('Lugares').fill('10')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText(/Há saídas com mais vagas do que estes lugares/)).toBeVisible()
  await page.getByRole('button', { name: 'Apagar veículo' }).click()
  await page.getByRole('button', { name: 'Apagar mesmo' }).click()
  await expect(page.getByText('Este veículo já foi usado em saídas. Arquive em vez de apagar.')).toBeVisible()

  // Archive: leaves the active list, shows under Arquivados
  await page.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByText(/· arquivado/)).toBeVisible()
  await page.goto('/veiculos')
  await expect(page.getByText('Nenhum veículo ainda.')).toBeVisible()
  await page.getByRole('link', { name: 'Arquivados' }).click()
  await expect(page.getByRole('table', { name: 'Veículos' })).toContainText('Van 01')
})
