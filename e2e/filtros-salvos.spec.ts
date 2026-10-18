import { expect, test, type Page } from '@playwright/test'

async function novoCliente(page: Page, nome: string) {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
}

test('saved filters: save, apply, rename and delete on Clients and Funnel; missing criteria warn (R82–R84)', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa filtros')
  await page.getByLabel('Nome da agência').fill('Agência filtros')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-filtros-${Date.now()}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
  await novoCliente(page, 'Ana Souza')
  await novoCliente(page, 'Beto Lima')

  // Save the current search on Clients
  await page.goto('/?q=ana&visao=cartoes')
  const meus = page.getByRole('region', { name: 'Meus filtros' })
  await meus.getByLabel('Nome do filtro').fill('Só a Ana')
  await meus.getByRole('button', { name: 'Salvar filtro' }).click()
  await expect(meus.getByText('Filtro salvo.')).toBeVisible()

  // Same name again is refused with a clear message
  await meus.getByLabel('Nome do filtro').fill(' só a ana ')
  await meus.getByRole('button', { name: 'Salvar filtro' }).click()
  await expect(meus.getByText(/Já existe um filtro com esse nome/)).toBeVisible()

  // Apply it from a clean list
  await page.goto('/')
  await page.getByRole('region', { name: 'Meus filtros' }).getByRole('link', { name: 'Só a Ana' }).click()
  await expect(page).toHaveURL(/\?q=ana&visao=cartoes$/)
  await expect(page.getByText('Beto Lima')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ana Souza' }).first()).toBeVisible()

  // Rename and delete (inside "Editar meus filtros")
  const abrirEdicao = () => meus.locator('details').evaluate((d: HTMLDetailsElement) => { d.open = true })
  await meus.getByText('Editar meus filtros').click()
  await meus.getByLabel('Novo nome para Só a Ana').fill('Ana')
  await meus.getByRole('button', { name: 'Renomear Só a Ana' }).click()
  await expect(meus.getByRole('link', { name: 'Ana', exact: true })).toBeVisible()
  await abrirEdicao()
  await meus.getByRole('button', { name: 'Excluir Ana' }).click()
  await expect(meus.getByRole('link', { name: 'Ana', exact: true })).toHaveCount(0)

  // Funnel has its own list
  await page.goto('/funil?visao=tabela&agrupar=responsavel')
  const meusFunil = page.getByRole('region', { name: 'Meus filtros' })
  await meusFunil.getByLabel('Nome do filtro').fill('Por pessoa')
  await meusFunil.getByRole('button', { name: 'Salvar filtro' }).click()
  await expect(meusFunil.getByText('Filtro salvo.')).toBeVisible()
  await page.goto('/funil')
  await meusFunil.getByRole('link', { name: 'Por pessoa' }).click()
  await expect(page).toHaveURL(/\/funil\?visao=tabela&agrupar=responsavel$/)

  // A tag or person that no longer exists is dropped with a warning
  await page.goto('/?etiqueta=11111111-1111-4111-8111-111111111111')
  await expect(page.getByText('Um critério deste filtro não existe mais')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Beto Lima' }).first()).toBeVisible()
  await page.goto('/funil?pessoa=22222222-2222-4222-8222-222222222222')
  await expect(page.getByText('Um critério deste filtro não existe mais')).toBeVisible()
})
