import { expect, test } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day

test('reservations suggest moving the linked deal (Reservado, then Pago), one tap or "Agora não", never automatic nor for unlinked deals', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa sugestões')
  await page.getByLabel('Nome da agência').fill('Agência sugestões')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-sugestoes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Souza' })).toBeVisible()
  const urlAna = page.url()

  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Lisboa clássica')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Lisboa clássica', level: 1 })).toBeVisible()
  await page.getByLabel('Data da saída').fill('2027-03-10')
  await page.getByLabel('Vagas (capacidade)').fill('10')
  await page.getByLabel('Preço por pessoa (R$)').fill('1.000,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await page.getByRole('link', { name: /10\/03\/2027/ }).click()
  await expect(page.getByRole('heading', { name: 'Saída de 10/03/2027' })).toBeVisible()
  const urlSaida = page.url()
  // Two deals for Ana: one linked to this departure, one not linked (e.g. another trip she is considering)
  for (const [titulo, ligada] of [['Lisboa da Ana', true], ['Cruzeiro da Ana', false]] as const) {
    await page.goto(urlAna)
    await page.getByRole('link', { name: 'Nova negociação' }).click()
    await page.getByLabel('Título').fill(titulo)
    await page.getByLabel('Valor (R$)').fill('1.000,00')
    if (ligada) await page.getByLabel('Saída (opcional)').selectOption({ label: 'Lisboa clássica · 10/03/2027' })
    await page.getByRole('button', { name: 'Criar negociação' }).click()
    await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
  }
  const urlCruzeiro = page.url()
  await page.goto('/funil?visao=tabela')
  await page.getByRole('link', { name: 'Lisboa da Ana' }).click()
  await expect(page.getByRole('heading', { name: 'Lisboa da Ana', level: 1 })).toBeVisible()
  const urlNeg = page.url()
  await expect(page.getByRole('region', { name: 'Sugestão' })).toHaveCount(0)

  await page.goto(urlSaida)
  await page.getByLabel(/Buscar cliente/).fill('ana')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: /Ana Souza/ }).click()
  await page.getByLabel('Número de pessoas').fill('1')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()

  // A reservation suggests Reservado; the deal did not move by itself
  await page.goto(urlNeg)
  const sugestao = page.getByRole('region', { name: 'Sugestão' })
  await expect(sugestao).toContainText('O cliente tem reserva em Lisboa clássica · 10/03/2027. Mover esta negociação para Reservado?')
  await expect(page.getByText(/Interessado · 10%/)).toBeVisible()

  // "Agora não" sticks
  await sugestao.getByRole('button', { name: 'Agora não' }).click()
  await expect(sugestao).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Lisboa da Ana', level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Sugestão' })).toHaveCount(0)

  // Paying in full brings a new suggestion: Pago
  await page.goto(urlSaida)
  await page.getByRole('listitem').filter({ hasText: 'Ana Souza' }).getByRole('link', { name: 'Pagamentos e detalhes' }).click()
  await expect(page.getByRole('heading', { name: /Reserva de Ana Souza/ })).toBeVisible()
  await page.getByLabel('Valor (R$)', { exact: true }).fill('1.000,00')
  await page.getByLabel('Data do pagamento').fill(iso(0))
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('Reserva quitada: não há saldo a receber.')).toBeVisible() // paid in full: the form gives way to this

  // One tap on the kanban card
  await page.goto('/funil')
  const cartao = page.locator('li[draggable]').filter({ hasText: 'Lisboa da Ana' })
  await expect(cartao).toContainText('Sugestão: A reserva em Lisboa clássica · 10/03/2027 está quitada.')
  await cartao.getByRole('button', { name: 'Mover para Pago' }).click()
  await expect(page.getByText('Negociação movida.')).toBeVisible()
  await expect(page.getByLabel('Mover Lisboa da Ana para')).toHaveValue('pago')
  await expect(cartao).not.toContainText('Sugestão')

  await page.goto(urlNeg)
  await expect(page.getByText(/Pago · 100%/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Sugestão' })).toHaveCount(0)

  // The deal not linked to the departure never got a suggestion (no guessing which trip it is)
  await page.goto(urlCruzeiro)
  await expect(page.getByRole('heading', { name: 'Cruzeiro da Ana', level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Sugestão' })).toHaveCount(0)
  await page.goto('/funil')
  await expect(page.locator('li[draggable]').filter({ hasText: 'Cruzeiro da Ana' })).not.toContainText('Sugestão')
})
