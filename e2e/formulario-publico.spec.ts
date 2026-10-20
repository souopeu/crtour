import { expect, test } from '@playwright/test'

test('public lead form: owner turns it on, a visitor sends, the lead lands in the funnel (R65–R68)', async ({ page, browser }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Dona Ana')
  await page.getByLabel('Nome da agência').fill('Viagens Alfa')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-form-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  // Owner: turn it on, edit the texts, copy the links
  await page.goto('/configuracoes')
  const secao = page.getByRole('region', { name: 'Formulário de captação' })
  await secao.getByLabel('Título').fill('Fale com a Viagens Alfa')
  await secao.getByLabel('Texto de apresentação').fill('Conte para onde quer ir.')
  await secao.getByLabel('Formulário ligado').check()
  await secao.getByRole('button', { name: 'Salvar formulário' }).click()
  await expect(secao.getByText('Formulário salvo.')).toBeVisible()
  const link = await secao.getByLabel('Link do formulário', { exact: true }).inputValue()
  expect(link).toMatch(/\/f\/[A-Za-z0-9_-]{24}$/)
  const linkInstagram = await secao.getByLabel('Link para a bio do Instagram').inputValue()
  expect(linkInstagram).toBe(`${link}?o=instagram`)
  await expect(secao.getByRole('img', { name: 'QR code do link do formulário' })).toBeVisible()

  // Visitor (no session): sees only the agency and its texts
  const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const visitante = await contexto.newPage()
  await visitante.goto(`${new URL(linkInstagram).pathname}?o=instagram&utm_campaign=verao`)
  await expect(visitante.getByRole('heading', { name: 'Fale com a Viagens Alfa' })).toBeVisible()
  await expect(visitante.getByText('Conte para onde quer ir.')).toBeVisible()
  await expect(visitante.getByText('Viagens Alfa', { exact: true })).toBeVisible()
  await expect(visitante.getByRole('navigation', { name: 'Principal' })).toHaveCount(0)

  await visitante.getByRole('button', { name: 'Enviar' }).click()
  await expect(visitante.getByText('Digite seu nome.')).toBeVisible()
  await visitante.getByLabel('Seu nome').fill('Maria Souza')
  await visitante.getByLabel('WhatsApp', { exact: true }).fill('(11) 99999-0001')
  await visitante.getByLabel('Para onde quer viajar').fill('Lisboa')
  await visitante.getByLabel('Quantas pessoas').fill('2')
  await visitante.getByLabel(/Aceito receber mensagens/).check()
  await visitante.getByRole('button', { name: 'Enviar' }).click()
  await expect(visitante.getByText('Recebemos seu contato!')).toBeVisible()

  // A wrong code reveals nothing
  await visitante.goto('/f/codigo-que-nao-existe-00000')
  await expect(visitante.getByText('could not be found')).toBeVisible()

  // Owner: the lead is in the funnel, and there is a notice
  await page.goto('/funil')
  await expect(page.getByRole('link', { name: 'Formulário: Lisboa' })).toBeVisible()
  await page.goto('/avisos')
  await expect(page.getByText('Novo contato pelo formulário: Maria Souza')).toBeVisible()
  await page.goto('/?q=maria')
  await expect(page.getByRole('row', { name: /Maria Souza/ })).toContainText('Instagram')
  await expect(page.getByRole('row', { name: /Maria Souza/ })).toContainText('Aceitou mensagens')

  // Turned off: the link stops working
  await page.goto('/configuracoes')
  await secao.getByLabel('Formulário ligado').uncheck()
  await secao.getByRole('button', { name: 'Salvar formulário' }).click()
  await expect(secao.getByText('Formulário salvo.')).toBeVisible()
  await visitante.goto(new URL(link).pathname)
  await expect(visitante.getByText('could not be found')).toBeVisible()
  await contexto.close()
})
