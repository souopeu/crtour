import { expect, test, type Page } from '@playwright/test'
import { atualizar } from './banco'

// Next keeps the previous page mounted but hidden; role queries only see the visible form.
const filtros = (page: Page) => page.getByRole('form', { name: 'Critérios do segmento' })
const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day

test('segment "já viajou para" and editing the criteria of a saved segment', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa viajou')
  await page.getByLabel('Nome da agência').fill('Agência viajou')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-viajou-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  for (const nome of ['Ana Viajante', 'Bia Ficou']) {
    await page.goto('/clientes/novo')
    await page.getByLabel('Nome', { exact: true }).fill(nome)
    await page.getByLabel('Consentimento').selectOption('aceitou')
    await page.getByRole('textbox', { name: /WhatsApp/ }).fill(nome.startsWith('Ana') ? '(11) 99999-0001' : '(11) 99999-0002')
    await page.getByRole('button', { name: 'Salvar cliente' }).click()
    await expect(page.getByRole('heading', { name: nome })).toBeVisible()
  }

  // A trip that already happened: reserve on a future departure, then move the date to the past
  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Serra Gaúcha')
  await page.getByLabel('Destino').fill('Gramado')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Serra Gaúcha', level: 1 })).toBeVisible()
  await page.getByLabel('Data da saída').fill(iso(20))
  await page.getByLabel('Vagas (capacidade)').fill('10')
  await page.getByLabel('Preço por pessoa (R$)').fill('900,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await page.getByRole('link', { name: new RegExp(iso(20).split('-').reverse().join('/')) }).click()
  await expect(page.getByRole('heading', { name: /Saída de/ })).toBeVisible()
  const saidaId = page.url().split('/').pop()!
  await page.getByLabel(/Buscar cliente/).fill('ana')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: /Ana Viajante/ }).click()
  await page.getByLabel('Número de pessoas').fill('1')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()

  // Not yet travelled: the departure is in the future
  await page.goto('/remarketing/novo?viajouPara=gramado')
  await expect(page.getByRole('region', { name: /clientes?$/ }).getByRole('heading')).toHaveText('0 clientes')
  await atualizar('saidas', saidaId, { data: iso(-30) })

  await filtros(page).getByLabel('Já viajou para (destino ou passeio)').fill('GRAMADO')
  await filtros(page).getByRole('button', { name: 'Ver clientes' }).click()
  const previa = page.getByRole('region', { name: /clientes?$/ })
  await expect(previa.getByRole('heading')).toHaveText('1 cliente')
  await expect(previa).toContainText('Ana Viajante')
  await expect(previa).toContainText('Já viajou para: GRAMADO')
  await page.getByLabel('Nome do segmento').fill('Voltar para a serra')
  await page.getByRole('button', { name: 'Salvar segmento' }).click()
  await expect(page.getByRole('heading', { name: 'Voltar para a serra', level: 1 })).toBeVisible()
  const urlSegmento = page.url()
  await expect(page.getByRole('region', { name: /Para chamar/ })).toContainText('Ana Viajante')

  // Edit the criteria: by the tour name, then something nobody matches
  await page.getByRole('link', { name: 'Editar critérios' }).click()
  await expect(filtros(page).getByLabel('Já viajou para (destino ou passeio)')).toHaveValue('GRAMADO') // starts from the saved criteria
  await filtros(page).getByLabel('Já viajou para (destino ou passeio)').fill('serra')
  await filtros(page).getByRole('button', { name: 'Ver clientes' }).click()
  await expect(page.getByRole('region', { name: /clientes?$/ }).getByRole('heading')).toHaveText('1 cliente')
  await page.getByRole('button', { name: 'Salvar critérios' }).click()
  await expect(page).toHaveURL(urlSegmento)
  await expect(page.getByText(/Já viajou para: serra/).filter({ visible: true })).toBeVisible()

  await page.getByRole('link', { name: 'Editar critérios' }).click()
  await filtros(page).getByLabel('Já viajou para (destino ou passeio)').fill('Paris')
  await filtros(page).getByRole('button', { name: 'Ver clientes' }).click()
  await expect(page.getByRole('region', { name: /clientes?$/ }).getByRole('heading')).toHaveText('0 clientes')
  await page.getByRole('button', { name: 'Salvar critérios' }).click()
  await expect(page).toHaveURL(urlSegmento)
  await expect(page.getByRole('region', { name: /Para chamar/ })).toContainText('Ninguém para chamar nesta rodada.')
})
