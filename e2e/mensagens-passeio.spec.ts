import { expect, test, type Page } from '@playwright/test'
import { atualizar } from './banco'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day
const br = (d: string) => d.split('-').reverse().join('/')

async function novoCliente(page: Page, nome: string, whatsapp: string, consentimento: string) {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  await page.getByRole('textbox', { name: /WhatsApp/ }).fill(whatsapp)
  await page.getByLabel('Consentimento').selectOption(consentimento)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
  return page.url()
}

test('tour messages: confirmation, reminder and review queue, one by one, consent respected', async ({ page, context }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa mensagens')
  await page.getByLabel('Nome da agência').fill('Agência mensagens')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-msgpasseio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  const fichaAna = await novoCliente(page, 'Ana Souza', '(11) 99999-0001', 'aceitou')
  await novoCliente(page, 'Caio Saiu', '(11) 99999-0003', 'pediu_saida')
  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Serra')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Serra', level: 1 })).toBeVisible()
  await page.getByLabel('Data da saída').fill(iso(2))
  await page.getByLabel('Vagas (capacidade)').fill('10')
  await page.getByLabel('Preço por pessoa (R$)').fill('1.000,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await page.getByRole('link', { name: new RegExp(br(iso(2))) }).click()
  await expect(page.getByRole('heading', { name: /Saída de/ })).toBeVisible()
  const saidaId = page.url().split('/').pop()!
  for (const [busca, nome] of [['ana', 'Ana Souza'], ['caio', 'Caio Saiu']]) {
    await page.getByLabel(/Buscar cliente/).fill(busca)
    await page.getByRole('button', { name: 'Buscar' }).click()
    await page.getByRole('link', { name: new RegExp(nome) }).click()
    await page.getByLabel('Número de pessoas').fill('1')
    await page.getByRole('button', { name: 'Reservar' }).click()
    await expect(page.getByText('Reserva feita.')).toBeVisible()
  }

  // Queue: confirmation (upcoming) and reminder (2 days before) for both; who asked to leave has no button
  await page.goto('/hoje')
  const fila = page.getByRole('region', { name: /Mensagens do passeio/ })
  await expect(fila.getByRole('heading')).toHaveText('Mensagens do passeio (4)')
  const confAna = fila.getByRole('listitem').filter({ hasText: 'Confirmação' }).filter({ hasText: 'Ana Souza' })
  await expect(confAna).toContainText(`Olá, Ana! Sua reserva para Serra em ${br(iso(2))} está confirmada.`)
  const caio = fila.getByRole('listitem').filter({ hasText: 'Caio Saiu' })
  await expect(caio.first()).toContainText('Pediu para não receber mensagens: não enviar.')
  await expect(fila.getByRole('link', { name: /para Caio Saiu no WhatsApp/ })).toHaveCount(0)

  // Send and register: leaves the queue and goes to the client's timeline
  await context.route('https://wa.me/**', (rota) => rota.fulfill({ status: 200, contentType: 'text/html', body: '<p>wa.me</p>' }))
  const aba = context.waitForEvent('page')
  await confAna.getByRole('link', { name: 'Enviar confirmação para Ana Souza no WhatsApp' }).click()
  await (await aba).close()
  await confAna.getByRole('button', { name: 'Registrar envio' }).click()
  await expect(fila.getByRole('heading')).toHaveText('Mensagens do passeio (3)')
  await page.goto(fichaAna)
  await expect(page.getByRole('region', { name: 'Linha do tempo' })).toContainText('Mensagem do passeio (confirmação): Olá, Ana!')

  // The owner edits the reminder and its days
  await page.goto('/configuracoes')
  const form = page.getByRole('form', { name: 'Mensagens do passeio' })
  await form.getByLabel('Lembrete: dias antes da saída').fill('0')
  await form.getByRole('button', { name: 'Salvar mensagens' }).click()
  await expect(form.getByText('Use um número de dias de 1 a 60.')).toBeVisible()
  await form.getByLabel('Lembrete: dias antes da saída').fill('2')
  await form.getByLabel('Mensagem de lembrete').fill('Oi {nome}, {passeio} em {data}. Saldo: {saldo}.')
  await form.getByRole('button', { name: 'Salvar mensagens' }).click()
  await expect(page.getByText('Mensagens salvas.')).toBeVisible()
  await page.goto('/hoje')
  await expect(fila.getByRole('listitem').filter({ hasText: 'Lembrete' }).filter({ hasText: 'Ana Souza' })).toContainText(`Oi Ana, Serra em ${br(iso(2))}. Saldo: R$ 1.000,00.`)

  await page.goto('/configuracoes')
  await form.getByLabel('Lembrete: dias antes da saída').fill('1')
  await form.getByRole('button', { name: 'Salvar mensagens' }).click()
  await expect(page.getByText('Mensagens salvas.')).toBeVisible()
  await page.goto('/hoje')
  await expect(fila.getByRole('listitem').filter({ hasText: 'Lembrete' })).toHaveCount(0) // 2 days ahead, reminder only 1 day before now

  // After the trip: review request
  await atualizar('saidas', saidaId, { data: iso(-1) })
  await page.goto('/hoje')
  await expect(fila.getByRole('listitem').filter({ hasText: 'Avaliação' }).filter({ hasText: 'Ana Souza' })).toContainText('Olá, Ana! Como foi o Serra?')
})
