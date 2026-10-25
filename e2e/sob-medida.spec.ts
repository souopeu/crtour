import { expect, test } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day (UTC-3)

// E9-5 (R142): a tailor-made service becomes a reservation in one step and works like any other, without showing as a tour.
test('serviço sob medida', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa sob medida')
  await page.getByLabel('Nome da agência').fill('Agência sob medida')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-sobmedida-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Lia Transfer')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Lia Transfer' })).toBeVisible()

  // Reservas → Nova reserva → client → service
  await page.goto('/reservas')
  await page.getByRole('link', { name: 'Nova reserva' }).click()
  await expect(page.getByRole('heading', { name: 'Nova reserva', level: 1 })).toBeVisible()
  await page.getByLabel(/Buscar cliente/).fill('lia')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: /Lia Transfer/ }).click()
  const form = page.getByRole('form', { name: 'Serviço sob medida' })
  await form.getByRole('button', { name: 'Criar reserva' }).click()
  await expect(form.getByText(/Diga qual é o serviço/)).toBeVisible()

  const dia = iso(2)
  await form.getByLabel('Serviço').fill('Transfer aeroporto → hotel')
  await form.getByLabel('Data').fill(dia)
  await form.getByLabel('Horário (opcional)').fill('06:30')
  await form.getByLabel('Número de pessoas').fill('3')
  await form.getByLabel('Valor total combinado (R$)').fill('450,00')
  await form.getByRole('button', { name: 'Criar reserva' }).click()

  // It lands on the reservation: total as agreed, status like any reservation
  await expect(page).toHaveURL(/\/reservas\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: /Reserva de Lia Transfer/ })).toBeVisible()
  await expect(page.getByText('R$ 450,00').first()).toBeVisible()
  await expect(page.getByRole('region', { name: 'Status da operação' }).getByRole('button', { name: 'A definir' })).toHaveAttribute('aria-current', 'step')

  // It is in Saídas do dia, but not in the tour list
  await page.goto(`/operacao?dia=${dia}`)
  const cartao = page.getByRole('article')
  await expect(cartao).toContainText('06:30')
  await expect(cartao).toContainText('Transfer aeroporto → hotel')
  await expect(cartao).toContainText('3 / 3 lugares')
  await page.goto('/passeios')
  await expect(page.getByText('Transfer aeroporto → hotel')).toHaveCount(0)
})
