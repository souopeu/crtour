import { expect, test, type APIRequestContext } from '@playwright/test'

// Needs a local Supabase with e-mail confirmation ON and Mailpit running:
//   E2E_EMAIL=1 npx playwright test e2e/email.spec.ts   (see docs/07-guia-publicacao.md)
test.skip(!process.env.E2E_EMAIL, 'set E2E_EMAIL=1 with confirmations enabled in supabase/config.toml')

const MAILPIT = 'http://127.0.0.1:54424'

async function esperarEmail(request: APIRequestContext, para: string, assunto: RegExp) {
  for (let i = 0; i < 40; i++) {
    const busca = await (await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${para}` } })).json()
    const achado = (busca.messages ?? []).find((m: { Subject: string }) => assunto.test(m.Subject))
    if (achado) return (await (await request.get(`${MAILPIT}/api/v1/message/${achado.ID}`)).json()) as { HTML: string; Subject: string }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`e-mail para ${para} (${assunto}) não chegou`)
}

// Keeps path + query only, so the test hits the app under test whatever host the template used.
function caminhoDoLink(html: string) {
  const href = /href="([^"]*\/auth\/confirmar[^"]*)"/.exec(html)?.[1]
  if (!href) throw new Error('link /auth/confirmar não encontrado no e-mail')
  const url = new URL(href.replace(/&amp;/g, '&'))
  return { caminho: url.pathname + url.search, params: url.searchParams }
}

test('confirm signup, reuse blocked, reset password, invalid links', async ({ page, request }) => {
  const email = `mail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`
  const senha = 'senha1234'
  const novaSenha = 'novaSenha99'

  // Signup asks for confirmation instead of logging in
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa Email')
  await page.getByLabel('Nome da agência').fill('Agência Email')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('Enviamos um link de confirmação')).toBeVisible()

  // Cannot log in before confirming
  await page.goto('/login')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Confirme seu e-mail pelo link')).toBeVisible()

  // The e-mail is in Portuguese and carries token_hash + type
  const confirmacao = await esperarEmail(request, email, /Confirme seu e-mail/)
  expect(confirmacao.HTML).toContain('Confirmar meu e-mail')
  const link = caminhoDoLink(confirmacao.HTML)
  expect(link.params.get('type')).toBe('signup')
  expect(link.params.get('token_hash')).toBeTruthy()

  await page.goto(link.caminho)
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()

  // A used link no longer works
  await page.getByRole('button', { name: 'Sair' }).click()
  await page.goto(link.caminho)
  await expect(page).toHaveURL(/\/login\?erro=link/)
  await expect(page.getByText('Esse link expirou ou já foi usado')).toBeVisible()

  // Password reset: same answer for unknown e-mails, no mail sent to them
  const desconhecido = `ninguem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`
  await page.goto('/recuperar')
  await page.getByLabel('E-mail', { exact: true }).fill(desconhecido)
  await page.getByRole('button', { name: 'Enviar link' }).click()
  const mensagem = 'Se esse e-mail tiver conta, enviamos um link para criar uma nova senha.'
  await expect(page.getByText(mensagem)).toBeVisible()
  const semEmail = await (await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${desconhecido}` } })).json()
  expect(semEmail.messages ?? []).toHaveLength(0)

  await page.goto('/recuperar')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Enviar link' }).click()
  await expect(page.getByText(mensagem)).toBeVisible()

  const recuperacao = await esperarEmail(request, email, /nova senha/i)
  const linkSenha = caminhoDoLink(recuperacao.HTML)
  expect(linkSenha.params.get('type')).toBe('recovery')
  expect(linkSenha.params.get('next')).toBe('/nova-senha')

  await page.goto(linkSenha.caminho)
  await expect(page).toHaveURL('/nova-senha')
  await page.getByLabel('Nova senha', { exact: true }).fill(novaSenha)
  await page.getByLabel('Repita a nova senha').fill(novaSenha)
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page).toHaveURL('/')

  // Old password stops working, new one works
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
  await page.getByLabel('Senha', { exact: true }).fill(novaSenha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL('/')

  // Tampered or foreign links never log anyone in
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/auth/confirmar?token_hash=adulterado&type=recovery&next=/nova-senha')
  await expect(page).toHaveURL(/\/login\?erro=link/)
  await page.goto('/nova-senha')
  await expect(page).toHaveURL(/\/login/)
})
