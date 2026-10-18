import { expect, test } from '@playwright/test'

// R63: every empty list explains the next step and offers the action that fills it.
const TELAS: { url: string; texto: RegExp; acao: string }[] = [
  { url: '/', texto: /Você ainda não tem clientes/, acao: 'Cadastrar o primeiro cliente' },
  { url: '/funil', texto: /Nenhuma negociação ainda/, acao: 'Criar a primeira negociação' },
  { url: '/passeios', texto: /Você ainda não tem passeios/, acao: 'Criar o primeiro passeio' },
  { url: '/fornecedores', texto: /Nenhum fornecedor ainda/, acao: 'Cadastrar o primeiro fornecedor' },
  { url: '/remarketing', texto: /Nenhum segmento ainda/, acao: 'Criar o primeiro segmento' },
  { url: '/cobrancas', texto: /saldo em aberto/, acao: 'Ver passeios' },
  { url: '/comissoes', texto: /ainda não usa comissão/, acao: 'Configurações' },
  { url: '/avisos', texto: /Nenhum aviso ainda/, acao: 'Abrir o funil' },
  { url: '/painel', texto: /Ainda não há negociações/, acao: 'Abrir o funil' },
]

test('empty lists explain the next step and link to it (R63)', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa vazia')
  await page.getByLabel('Nome da agência').fill('Agência vazia')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-vazio-${Date.now()}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  for (const t of TELAS) {
    await page.goto(t.url)
    const vazio = page.getByRole('region', { name: 'Lista vazia' })
    await expect(vazio, t.url).toBeVisible()
    await expect(vazio, t.url).toContainText(t.texto)
    await expect(vazio.getByRole('link', { name: t.acao }), `${t.url} → ${t.acao}`).toBeVisible()
  }

  // Today's sections: each says what to do when there is nothing yet
  await page.goto('/hoje')
  const vazios = page.getByRole('region', { name: 'Lista vazia' })
  await expect(vazios.first()).toBeVisible() // the sections stream in
  for (const v of await vazios.all()) await expect(v.getByRole('link').first()).toBeVisible()
  await expect(vazios.getByRole('link', { name: 'Agendar pela ficha de um cliente' })).toBeVisible()
})
