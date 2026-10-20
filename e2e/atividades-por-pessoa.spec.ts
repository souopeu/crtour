import { expect, test } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day

test('painel: activities per person for the owner (R88, R89)', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Dona Relatório')
  await page.getByLabel('Nome da agência').fill('Agência relatório')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-relatorio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  // Empty month: the owner's row is there with zeros
  await page.goto('/painel')
  const secao = page.getByRole('region', { name: 'Atividades por pessoa' })
  await expect(secao.getByRole('row', { name: /Dona Relatório/ })).toBeVisible()

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Souza' })).toBeVisible()
  const atividades = page.getByRole('region', { name: 'Atividades' })
  for (const [titulo, quando, situacao] of [['Ligou para Ana', `${iso(0)}T00:05`, 'feito'], ['Retornar Ana', `${iso(-2)}T10:00`, 'pendente']]) {
    await atividades.getByLabel('Tipo').selectOption({ label: 'Ligação' })
    await atividades.getByLabel('O que fazer ou o que foi feito').fill(titulo)
    await atividades.getByLabel('Data e hora').fill(quando)
    await atividades.getByLabel('Situação').selectOption(situacao)
    await atividades.getByRole('button', { name: 'Salvar atividade' }).click()
    await expect(page.getByText(situacao === 'feito' ? 'Atividade registrada.' : 'Atividade agendada.')).toBeVisible()
  }

  await page.goto('/painel')
  const linha = secao.getByRole('row', { name: /Dona Relatório/ })
  await expect(linha.getByRole('cell').nth(1)).toHaveText('1') // calls
  await expect(linha.getByRole('cell').nth(6)).toHaveText('1') // total done
  await expect(linha.getByRole('cell').nth(7)).toHaveText('1') // overdue
})
