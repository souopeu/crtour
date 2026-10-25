import { expect, test } from '@playwright/test'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day (UTC-3)
const br = (data: string) => data.split('-').reverse().join('/')

// E9-4 (R141): start the boarding, mark who boarded (responsible and unnamed places), unmark, and count.
test('boarding and attendance list', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa embarque')
  await page.getByLabel('Nome da agência').fill('Agência embarque')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-embarque-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Lia Embarque')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Lia Embarque' })).toBeVisible()

  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Passeio de barco')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Passeio de barco', level: 1 })).toBeVisible()
  const dia = iso(2)
  await page.getByLabel('Data da saída').fill(dia)
  await page.getByLabel('Vagas (capacidade)').fill('10')
  await page.getByLabel('Preço por pessoa (R$)').fill('80,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await page.getByRole('link', { name: new RegExp(br(dia).replace(/\//g, '\\/')) }).click()
  await page.getByLabel(/Buscar cliente/).fill('lia')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: /Lia Embarque/ }).click()
  await page.getByLabel('Número de pessoas').fill('3')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()

  // The reservation is ready before the trip
  await page.goto(`/reservas?de=${dia}&ate=${dia}`)
  await page.getByRole('table', { name: 'Reservas' }).getByRole('link', { name: 'Lia Embarque' }).click()
  const status = page.getByRole('region', { name: 'Status da operação' })
  await status.getByRole('button', { name: 'Pronta' }).click()
  await expect(status.getByText('Status: Pronta.')).toBeVisible()

  // Start from the day's card: ready reservations go to "em execução", the card counts people on board
  await page.goto(`/operacao?dia=${dia}`)
  const cartao = page.getByRole('article').filter({ hasText: 'Passeio de barco' })
  await cartao.getByRole('button', { name: 'Iniciar embarque' }).click()
  await expect(cartao.getByRole('link', { name: /Embarque: 0 \/ 3 embarcados/ })).toBeVisible()
  await expect(cartao).toContainText('Em execução')

  // The attendance list: the responsible client and two places still without a name
  await cartao.getByRole('link', { name: /Embarque:/ }).click()
  await expect(page.getByRole('heading', { name: 'Embarque', level: 1 })).toBeVisible()
  const lista = page.getByRole('list', { name: 'Lista de presença' })
  await expect(lista.getByRole('checkbox')).toHaveCount(3)
  const lia = lista.getByRole('checkbox', { name: 'Lia Embarque' })
  await expect(lia).toHaveAttribute('aria-checked', 'false')
  await lia.click()
  await expect(lia).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('1 de 3 embarcados')).toBeVisible()
  await expect(lista).toContainText('marcado por Pessoa embarque')
  await lista.getByRole('checkbox').nth(1).click()
  await expect(page.getByText('2 de 3 embarcados')).toBeVisible()

  // Unmark, and the marks survive a reload
  await lia.click()
  await expect(lia).toHaveAttribute('aria-checked', 'false')
  await page.reload()
  await expect(page.getByText('1 de 3 embarcados')).toBeVisible()
  await page.goto(`/operacao?dia=${dia}`)
  await expect(page.getByRole('article').getByRole('link', { name: /Embarque: 1 \/ 3 embarcados/ })).toBeVisible()
})
