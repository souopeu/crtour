import { expect, test } from '@playwright/test'

// E5-4: the remaining screens follow the screen pattern (tabs, table with a summary row, in-page index).
test('Passeios, Cobranças and Configurações in the screen pattern', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa padrão')
  await page.getByLabel('Nome da agência').fill('Agência padrão')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-padrao-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Lisboa clássica')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Lisboa clássica', level: 1 })).toBeVisible()

  await page.goto('/passeios')
  const visoes = page.getByRole('navigation', { name: 'Visões dos passeios' })
  await expect(visoes.getByRole('link', { name: 'Ativos' })).toHaveAttribute('aria-current', 'page')
  const tabela = page.getByRole('table', { name: 'Passeios' })
  await expect(tabela.getByRole('row', { name: /Lisboa clássica/ })).toContainText('0 saídas')
  await expect(tabela.getByRole('row', { name: /^Total/ })).toContainText('1 passeio')
  await visoes.getByRole('link', { name: 'Arquivados' }).click()
  await expect(visoes.getByRole('link', { name: 'Arquivados' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Nenhum passeio arquivado.')).toBeVisible()

  await page.goto('/cobrancas')
  await expect(page.getByRole('navigation', { name: 'Filtros das cobranças' }).getByRole('link', { name: 'Todas' })).toHaveAttribute('aria-current', 'page')

  await page.goto('/configuracoes')
  const indice = page.getByRole('navigation', { name: 'Nesta página' })
  for (const secao of ['Prazos da tela Hoje', 'Equipe', 'Mensagens do passeio', 'Comissão', 'Exportar seus dados', 'Excluir conta']) {
    await expect(indice.getByRole('link', { name: secao })).toBeVisible()
  }
  await indice.getByRole('link', { name: 'Excluir conta' }).click()
  await expect(page).toHaveURL(/#excluir-titulo$/)
})
