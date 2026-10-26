import { expect, test } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day (UTC-3)
const br = (data: string) => data.split('-').reverse().join('/')

// E10-1 (R145–R148): agency bills — single, in instalments and monthly — in one list with the departure costs.
test('contas a pagar: única, parcelada, mensal, pagar, desfazer e excluir', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa contas')
  await page.getByLabel('Nome da agência').fill('Agência contas')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-contas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/financeiro/contas')
  await expect(page.getByRole('navigation', { name: 'Seções do financeiro' }).getByRole('link', { name: 'Contas a pagar' })).toHaveAttribute('aria-current', 'page')
  const nova = page.getByRole('form', { name: 'Lançar conta' })
  await page.getByText('+ Nova conta a pagar').click() // stays open after each save, for the next bill

  // A bill for next month shows right after it is saved (the Guitur list hid it)
  await nova.getByLabel('Descrição').fill('Aluguel da loja')
  await nova.getByLabel('Categoria').selectOption('aluguel')
  await nova.getByLabel('Valor (R$)').fill('2.500,00')
  await nova.getByLabel('Vencimento').fill(iso(40))
  await nova.getByRole('button', { name: 'Lançar conta' }).click()
  await expect(page.getByText('Conta lançada.')).toBeVisible()
  const tabela = page.getByRole('table', { name: 'Contas a pagar' })
  await expect(tabela.getByRole('row', { name: /Aluguel da loja/ })).toContainText('R$ 2.500,00')

  // In 3 instalments: 333,34 + 333,33 + 333,33
  await nova.getByLabel('Descrição').fill('Notebook')
  await nova.getByLabel('Categoria').selectOption('sistemas')
  await nova.getByText('Parcelada').click()
  await nova.getByLabel('Valor total (R$)').fill('1.000,00')
  await nova.getByLabel('Número de parcelas').fill('3')
  await nova.getByRole('button', { name: 'Lançar conta' }).click()
  await expect(page.getByText('Conta lançada em 3 parcelas.')).toBeVisible()
  await expect(tabela.getByRole('row', { name: /Notebook/ })).toHaveCount(3)
  await expect(tabela.getByRole('row', { name: /Parcela 1 de 3/ })).toContainText('R$ 333,34')
  await expect(tabela.getByRole('row', { name: /Parcela 3 de 3/ })).toContainText('R$ 333,33')

  // Monthly
  await nova.getByLabel('Descrição').fill('Sistema de reservas')
  await nova.getByText('Todo mês').click()
  await nova.getByLabel('Valor (R$)').fill('99,00')
  await nova.getByRole('button', { name: 'Lançar conta' }).click()
  await expect(page.getByText('Conta mensal lançada.')).toBeVisible()
  await expect(tabela.getByRole('row', { name: /Sistema de reservas/ })).toContainText('Mensal')

  // Pay from the list; it leaves "A pagar" and shows under "Pagas"
  const aluguel = tabela.getByRole('row', { name: /Aluguel da loja/ })
  await aluguel.getByRole('button', { name: 'Pagar Aluguel da loja' }).click()
  await aluguel.getByLabel('Forma').selectOption('transferencia')
  await aluguel.getByRole('button', { name: 'Confirmar' }).click()
  await expect(tabela.getByRole('row', { name: /Aluguel da loja/ })).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Situação das contas' }).getByRole('link', { name: 'Pagas' }).click()
  await expect(tabela.getByRole('row', { name: /Aluguel da loja/ })).toContainText(`em ${br(iso(0))}`)

  // Undo the payment on the bill page
  await tabela.getByRole('link', { name: 'Aluguel da loja' }).click()
  await expect(page.getByText(/Paga em/)).toBeVisible()
  await page.getByRole('button', { name: 'Desfazer pagamento' }).click()
  await page.getByRole('button', { name: 'Desfazer mesmo' }).click()
  await expect(page.getByRole('button', { name: 'Pagar Aluguel da loja' })).toBeVisible() // back to "to pay"
  await expect(page.getByText(/Paga em/)).toHaveCount(0)

  // Delete the 2nd instalment and the next ones
  await page.goto('/financeiro/contas')
  await tabela.getByRole('row', { name: /Parcela 2 de 3/ }).getByRole('link', { name: 'Notebook' }).click()
  await page.getByRole('button', { name: 'Excluir esta e as próximas' }).click()
  await page.getByRole('button', { name: 'Excluir todas' }).click()
  await expect(page).toHaveURL('/financeiro/contas')
  await expect(tabela.getByRole('row', { name: /Notebook/ })).toHaveCount(1)

  // Stop the monthly series
  await tabela.getByRole('link', { name: 'Sistema de reservas' }).click()
  await page.getByRole('button', { name: 'Parar de repetir' }).click()
  await expect(page.getByText('Esta conta se repete todo mês.')).toHaveCount(0)
})
