import { expect, test } from '@playwright/test'

// E11-3 (R160–R161): questions on the tour, answered when selling and later, shown on the passenger list.
test('questions before the tour: ask, answer, what is missing, passenger list', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa perguntas')
  await page.getByLabel('Nome da agência').fill('Agência perguntas')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-perguntas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Ana Perguntas')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Perguntas' })).toBeVisible()

  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Voo livre')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Voo livre', level: 1 })).toBeVisible()

  // Two questions: hotel (per reservation) and weight (per passenger), both required
  const nova = page.getByRole('form', { name: 'Nova pergunta' })
  await nova.getByLabel('Pergunta').fill('Hotel para busca')
  await nova.getByLabel('Obrigatória').check()
  await nova.getByRole('button', { name: 'Incluir pergunta' }).click()
  await expect(page.getByText('Pergunta incluída.')).toBeVisible()
  await nova.getByLabel('Pergunta').fill('Peso (kg)')
  await nova.getByLabel('Tipo de resposta').selectOption('numero')
  await nova.getByLabel('Obrigatória').check()
  await nova.getByLabel('Uma resposta por passageiro').check()
  await nova.getByRole('button', { name: 'Incluir pergunta' }).click()
  await expect(page.getByText('Número · por passageiro')).toBeVisible()

  await page.getByLabel('Data da saída').fill('2030-04-10')
  await page.getByLabel('Vagas (capacidade)').fill('10')
  await page.getByLabel('Preço por pessoa (R$)').fill('300,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await page.getByRole('link', { name: /10\/04\/2030/ }).click()
  await expect(page.getByRole('heading', { name: 'Saída de 10/04/2030' })).toBeVisible()

  // Sell to 2 people: a bad weight is refused, then sold with one weight missing
  await page.getByLabel(/Buscar cliente/).fill('ana')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: /Ana Perguntas/ }).click()
  await page.getByLabel('Número de pessoas').fill('2')
  await page.getByLabel(/Hotel para busca/).fill('Pousada Sol')
  await page.getByRole('group', { name: 'Pessoa 1 (responsável)' }).getByLabel(/Peso/).fill('leve')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Digite só o número.')).toBeVisible()
  await page.getByRole('group', { name: 'Pessoa 1 (responsável)' }).getByLabel(/Peso/).fill('70')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()

  // The reservation says what is missing; answering clears it
  await page.getByRole('link', { name: 'Pagamentos e detalhes' }).click()
  await expect(page.getByText('Faltam 1 resposta obrigatória.')).toBeVisible()
  await page.getByRole('group', { name: 'Pessoa 2' }).getByLabel(/Peso/).fill('62,5')
  await page.getByRole('button', { name: 'Salvar respostas' }).click()
  await expect(page.getByText('Respostas salvas.')).toBeVisible()
  await expect(page.getByText('Faltam 1 resposta obrigatória.')).toHaveCount(0)

  // The passenger list has one column per question
  await page.getByRole('link', { name: /Voo livre · saída de/ }).click()
  await page.getByRole('link', { name: /Lista de passageiros/ }).click()
  await expect(page.getByRole('columnheader', { name: 'Peso (kg)' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Ana Perguntas.*Pousada Sol.*70/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /nome a informar.*62,5/ })).toBeVisible()
})
