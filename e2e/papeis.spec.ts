import { expect, test, type Page } from '@playwright/test'

async function cadastrarDono(page: Page, email: string) {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Dona Ana')
  await page.getByLabel('Nome da agência').fill('Agência papéis')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('link', { name: 'Avisos' })).toBeVisible()
}

test('roles: owner invites a seller by link, seller works with limits, owner removes her', async ({ page: dono, browser }) => {
  const sufixo = Date.now()
  const emailVera = `e2e-vera-${sufixo}@teste.dev`
  await cadastrarDono(dono, `e2e-dono-${sufixo}@teste.dev`)

  await dono.goto('/clientes/novo')
  await dono.getByLabel('Nome', { exact: true }).fill('Cliente Compartilhada')
  await dono.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(dono.getByRole('heading', { name: 'Cliente Compartilhada' })).toBeVisible()
  const urlCliente = dono.url()
  for (const [titulo, valor] of [['Lisboa da Vera', '7.000,00'], ['Porto da Dona', '3.000,00']]) {
    await dono.goto(urlCliente)
    await dono.getByRole('link', { name: 'Nova negociação' }).click()
    await dono.getByLabel('Título').fill(titulo)
    await dono.getByLabel('Valor (R$)').fill(valor)
    await dono.getByRole('button', { name: 'Criar negociação' }).click()
    await expect(dono.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
  }

  // Owner creates the invite link
  await dono.goto('/configuracoes')
  const equipe = dono.getByRole('region', { name: 'Equipe' })
  await equipe.getByRole('button', { name: 'Gerar link de convite' }).click()
  await expect(equipe.getByText('Digite o nome da pessoa.')).toBeVisible()
  await equipe.getByLabel('Nome da pessoa').fill('Vera')
  await equipe.getByLabel('E-mail da pessoa').fill(emailVera.toUpperCase())
  await equipe.getByRole('button', { name: 'Gerar link de convite' }).click()
  await expect(equipe.getByText(`Convite criado para ${emailVera}.`)).toBeVisible()
  const link = await equipe.getByLabel('Link do convite').inputValue()
  expect(link).toContain('/cadastro?convite=')
  await expect(equipe.getByRole('list', { name: 'Convites pendentes' })).toContainText(emailVera)

  // Seller, in her own browser: wrong e-mail is refused, the right one joins the agency
  const ctxVera = await browser.newContext()
  const vera = await ctxVera.newPage()
  await vera.goto(link)
  await expect(vera.getByRole('heading', { name: 'Entrar na equipe' })).toBeVisible()
  await expect(vera.getByLabel('Nome da agência')).toHaveCount(0)
  await expect(vera.getByLabel('E-mail', { exact: true })).toHaveValue(emailVera)
  await vera.getByLabel('Seu nome').fill('Vera Vendas')
  await vera.getByLabel('E-mail', { exact: true }).fill(`outra-${sufixo}@teste.dev`)
  await vera.getByLabel('Senha', { exact: true }).fill('senha1234')
  await vera.getByRole('checkbox').check()
  await vera.getByRole('button', { name: 'Entrar na equipe' }).click()
  await expect(vera.getByText(/Este convite não vale mais/)).toBeVisible()
  await vera.getByLabel('E-mail', { exact: true }).fill(emailVera)
  await vera.getByLabel('Senha', { exact: true }).fill('senha1234')
  await vera.getByRole('checkbox').check()
  await vera.getByRole('button', { name: 'Entrar na equipe' }).click()
  await expect(vera.getByRole('link', { name: 'Painel' })).toBeVisible()
  await expect(vera.getByRole('link', { name: 'Avisos' })).toHaveCount(0)
  await expect(vera.getByText('Cliente Compartilhada')).toBeVisible() // same agency data

  // Hoje: the seller starts on her own items; an unassigned activity created by the owner shows only under "Todas"
  await dono.goto(urlCliente)
  const atividades = dono.getByRole('region', { name: 'Atividades' })
  await atividades.getByLabel('O que fazer ou o que foi feito').fill('Ligar para a cliente')
  await atividades.getByLabel('Data e hora').fill(`${new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)}T10:00`)
  await atividades.getByLabel('Situação').selectOption('pendente')
  await atividades.getByRole('button', { name: 'Salvar atividade' }).click()
  await expect(atividades.getByRole('listitem').filter({ hasText: 'Ligar para a cliente' })).toBeVisible()
  await dono.goto('/hoje')
  await expect(dono.getByRole('link', { name: 'Todas' })).toHaveAttribute('aria-current', 'page')
  await expect(dono.getByRole('region', { name: /Atrasadas/ })).toContainText('Ligar para a cliente')
  await vera.goto('/hoje')
  await expect(vera.getByRole('link', { name: 'Só as minhas' })).toHaveAttribute('aria-current', 'page')
  await expect(vera.getByRole('region', { name: /Atrasadas/ })).toContainText('Nada atrasado.')
  await vera.getByRole('link', { name: 'Todas' }).click()
  await expect(vera.getByRole('region', { name: /Atrasadas/ })).toContainText('Ligar para a cliente')

  // The same link cannot be used twice
  const ctxOutra = await browser.newContext()
  const outra = await ctxOutra.newPage()
  await outra.goto(link)
  await outra.getByLabel('Seu nome').fill('Copiona')
  await outra.getByLabel('Senha', { exact: true }).fill('senha1234')
  await outra.getByRole('checkbox').check()
  await outra.getByRole('button', { name: 'Entrar na equipe' }).click()
  await expect(outra.getByText(/Este convite não vale mais/)).toBeVisible()
  await ctxOutra.close()

  // The seller does not export, invite or change agency settings
  await vera.goto('/configuracoes')
  await expect(vera.getByText('Só o dono da agência baixa os dados.')).toBeVisible()
  await expect(vera.getByRole('link', { name: /Baixar clientes/ })).toHaveCount(0)
  await expect(vera.getByText('Só o dono convida ou remove pessoas.')).toBeVisible()
  await expect(vera.getByRole('button', { name: 'Salvar prazos' })).toHaveCount(0)
  expect((await vera.request.get('/exportar?tipo=clientes')).status()).toBe(403)

  // Owner sees her in the team and gives her a deal
  await dono.goto('/configuracoes')
  await expect(equipe.getByRole('list', { name: 'Pessoas da agência' })).toContainText('Vera Vendas · Vendedor(a)')
  await expect(equipe.getByRole('list', { name: 'Convites pendentes' })).toHaveCount(0)
  await dono.goto('/funil?visao=tabela')
  await dono.getByRole('link', { name: 'Lisboa da Vera' }).click()
  await dono.getByRole('region', { name: 'Dados da negociação' }).getByLabel('Responsável', { exact: true }).selectOption({ label: 'Vera Vendas' })
  await dono.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(dono.getByText('Alterações salvas.')).toBeVisible()

  // Her panel shows only her numbers, with no person filter and no agency goal
  await vera.goto('/painel')
  await expect(vera.getByText('Estes são os números das negociações em que você é a pessoa responsável.')).toBeVisible()
  await expect(vera.getByLabel('Responsável')).toHaveCount(0)
  await expect(vera.getByText('Pipeline aberto (agora)').locator('..')).toContainText('R$ 7.000,00')
  await expect(vera.getByRole('region', { name: /^Meta de/ })).toHaveCount(0)
  await expect(vera.getByRole('region', { name: /^Atividades por pessoa/ })).toHaveCount(0) // spec 18, R88: owner only

  // Owner removes her: she loses access, the deal stays without a person in charge
  await dono.goto('/configuracoes')
  await equipe.getByRole('button', { name: 'Remover acesso de Vera Vendas' }).click()
  await equipe.getByRole('button', { name: 'Remover mesmo' }).click()
  await expect(equipe.getByRole('list', { name: 'Pessoas da agência' })).not.toContainText('Vera Vendas')
  await vera.goto('/')
  await expect(vera.getByRole('heading', { name: 'Sem acesso a uma agência' })).toBeVisible()
  await expect(vera.getByText('Cliente Compartilhada')).toHaveCount(0)
  await dono.goto('/funil')
  await expect(dono.locator('li[draggable]').filter({ hasText: 'Lisboa da Vera' })).toContainText('Sem responsável')
  await ctxVera.close()
})
