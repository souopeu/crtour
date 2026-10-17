import { expect, test, type Page } from '@playwright/test'

async function cadastrar(page: Page, rotulo: string) {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill(`Pessoa ${rotulo}`)
  await page.getByLabel('Nome da agência').fill(`Agência ${rotulo}`)
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-${rotulo}-${Date.now()}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
}

test('tours and departures: create, validate, edit, archive, delete, isolation', async ({ page, browser }) => {
  await cadastrar(page, 'passeios')
  await page.getByRole('link', { name: 'Passeios' }).click()
  await expect(page.getByRole('heading', { name: 'Passeios' })).toBeVisible()
  await expect(page.getByText('Você ainda não tem passeios.')).toBeVisible()

  // Create a tour (name required)
  await page.getByRole('link', { name: 'Novo passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Novo passeio' })).toBeVisible()
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByText('Digite o nome do passeio.')).toBeVisible()
  await page.getByLabel('Nome do passeio').fill('Lisboa clássica')
  await page.getByLabel('Destino').fill('Portugal')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page).toHaveURL(/\/passeios\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: 'Lisboa clássica', level: 1 })).toBeVisible()
  const urlPasseio = page.url()

  // Departure validation, then success
  await page.getByLabel('Data da saída').fill('2027-03-10')
  await page.getByLabel('Vagas (capacidade)').fill('0')
  await page.getByLabel('Preço por pessoa (R$)').fill('caro')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await expect(page.getByText('A capacidade deve ser um número inteiro entre 1 e 500.')).toBeVisible()
  await expect(page.getByText('Digite o preço por pessoa')).toBeVisible()

  await page.getByLabel('Data da saída').fill('2027-03-10')
  await page.getByLabel('Vagas (capacidade)').fill('12')
  await page.getByLabel('Preço por pessoa (R$)').fill('8.900,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await expect(page.getByText('Saída criada.')).toBeVisible()
  const linhaSaida = page.getByRole('link', { name: /10\/03\/2027/ })
  await expect(linhaSaida).toContainText('Vagas: 0 / 12')
  await expect(linhaSaida).toContainText('R$ 8.900,00 por pessoa')
  await expect(linhaSaida).toContainText('Aberta')

  // Edit the departure
  await linhaSaida.click()
  await expect(page.getByRole('heading', { name: 'Saída de 10/03/2027' })).toBeVisible()
  const urlSaida = page.url()
  await page.getByLabel('Vagas (capacidade)').fill('14')
  await page.getByLabel('Preço por pessoa (R$)').fill('9.000,50')
  await page.getByLabel('Situação').selectOption('cancelada')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Alterações salvas.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Vagas (capacidade)')).toHaveValue('14')
  await expect(page.getByLabel('Preço por pessoa (R$)')).toHaveValue('9000,50')
  await expect(page.getByLabel('Situação')).toHaveValue('cancelada')

  // Another agency cannot open them
  const contexto = await browser.newContext({ baseURL: 'http://localhost:3100' })
  const outra = await contexto.newPage()
  await cadastrar(outra, 'outra-passeios')
  for (const alvo of [urlPasseio, urlSaida]) {
    await outra.goto(alvo)
    await expect(outra.getByText('could not be found')).toBeVisible()
  }
  await contexto.close()

  // Archive and unarchive
  await page.goto(urlPasseio)
  await page.getByRole('button', { name: 'Arquivar passeio' }).click()
  await expect(page.getByText('Arquivado', { exact: true })).toBeVisible()
  await page.goto('/passeios')
  await expect(page.getByText('Você ainda não tem passeios.')).toBeVisible()
  await page.getByRole('link', { name: 'Ver arquivados' }).click()
  await expect(page.getByRole('link', { name: /Lisboa clássica/ })).toBeVisible()
  await page.getByRole('link', { name: /Lisboa clássica/ }).click()
  await page.getByRole('button', { name: 'Desarquivar passeio' }).click()
  await expect(page.getByText('Arquivado', { exact: true })).toHaveCount(0)

  // A tour with departures cannot be deleted; delete the departure first, then the tour
  await page.getByRole('button', { name: 'Excluir passeio' }).click()
  await page.getByRole('button', { name: 'Excluir mesmo' }).click()
  await expect(page.getByText('Este passeio já tem saídas. Arquive em vez de excluir.')).toBeVisible()

  await page.goto(urlSaida)
  await page.getByRole('button', { name: 'Excluir saída' }).click()
  await page.getByRole('button', { name: 'Cancelar' }).click() // inline confirmation can be cancelled
  await expect(page.getByRole('heading', { name: 'Saída de 10/03/2027' })).toBeVisible()
  await page.getByRole('button', { name: 'Excluir saída' }).click()
  await page.getByRole('button', { name: 'Excluir mesmo' }).click()
  await expect(page).toHaveURL(urlPasseio)
  await expect(page.getByText('Nenhuma saída ainda.')).toBeVisible()

  await page.getByRole('button', { name: 'Excluir passeio' }).click()
  await page.getByRole('button', { name: 'Excluir mesmo' }).click()
  await expect(page).toHaveURL('/passeios')
  await expect(page.getByText('Você ainda não tem passeios.')).toBeVisible()
})
