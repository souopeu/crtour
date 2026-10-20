import { expect, test } from '@playwright/test'
import { arquivosNaPasta } from './banco'

const iso = (dias: number) => new Date(Date.now() + dias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) // Brazil day
const pdf = { name: 'comprovante.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%comprovante de teste\n') }
const falso = { name: 'falso.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html><script>alert(1)</script></html>') }

test('payment receipt: attach, open by a short link, refuse fake files, remove; account deletion removes the file (R93–R95)', async ({ page }) => {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill('Pessoa comprovante')
  await page.getByLabel('Nome da agência').fill('Agência comprovante')
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-comprovante-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/clientes/novo')
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza')
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Souza' })).toBeVisible()
  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Lisboa clássica')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Lisboa clássica', level: 1 })).toBeVisible()
  await page.getByLabel('Data da saída').fill('2030-03-10')
  await page.getByLabel('Vagas (capacidade)').fill('10')
  await page.getByLabel('Preço por pessoa (R$)').fill('1.000,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await page.getByRole('link', { name: /10\/03\/2030/ }).click()
  await expect(page.getByRole('heading', { name: 'Saída de 10/03/2030' })).toBeVisible()
  await page.getByLabel(/Buscar cliente/).fill('ana')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: /Ana Souza/ }).click()
  await page.getByLabel('Número de pessoas').fill('1')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: 'Ana Souza' }).getByRole('link', { name: 'Pagamentos e detalhes' }).click()
  await page.getByLabel('Valor (R$)', { exact: true }).fill('500,00')
  await page.getByLabel('Data do pagamento').fill(iso(0))
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(page.getByText('Pagamento registrado.')).toBeVisible()

  const pagamento = page.getByRole('listitem').filter({ hasText: 'Sinal' })
  await expect(pagamento.getByText(/Não anexe documentos pessoais/)).toBeVisible()

  // A file that only pretends to be a PDF is refused
  await pagamento.getByLabel('Comprovante (PDF, JPG ou PNG, até 4 MB)').setInputFiles(falso)
  await pagamento.getByRole('button', { name: 'Anexar comprovante' }).click()
  await expect(pagamento.getByText('Envie um PDF, JPG ou PNG.')).toBeVisible()

  // A real PDF is stored and opens through a short-lived signed link
  await pagamento.getByLabel('Comprovante (PDF, JPG ou PNG, até 4 MB)').setInputFiles(pdf)
  await pagamento.getByRole('button', { name: 'Anexar comprovante' }).click()
  await expect(pagamento.getByText('Comprovante anexado.')).toBeVisible()
  const ver = pagamento.getByRole('link', { name: 'Ver comprovante' })
  const resposta = await page.request.get((await ver.getAttribute('href'))!, { maxRedirects: 0 })
  expect(resposta.status()).toBe(307)
  const assinado = resposta.headers()['location']
  expect(assinado).toMatch(/\/storage\/v1\/object\/sign\/comprovantes\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf\?token=/)
  const arquivo = await page.request.get(assinado)
  expect(arquivo.status()).toBe(200)
  expect((await arquivo.body()).toString()).toContain('%PDF-1.4')
  const pasta = /comprovantes\/([0-9a-f-]{36}\/[0-9a-f-]{36})\//.exec(assinado)![1]

  // Remove, then attach again
  await pagamento.getByRole('button', { name: 'Remover comprovante' }).click()
  await expect(ver).toHaveCount(0)
  expect(await arquivosNaPasta(pasta)).toEqual([])
  await pagamento.getByLabel('Comprovante (PDF, JPG ou PNG, até 4 MB)').setInputFiles(pdf)
  await pagamento.getByRole('button', { name: 'Anexar comprovante' }).click()
  await expect(ver).toBeVisible()
  expect(await arquivosNaPasta(pasta)).toHaveLength(1)

  // Deleting the account removes the files too
  await page.goto('/configuracoes')
  await page.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR')
  await page.getByLabel('Sua senha').fill('senha1234')
  await page.getByRole('button', { name: 'Excluir conta e todos os dados' }).click()
  await expect(page).toHaveURL(/\/login\?conta=excluida/)
  expect(await arquivosNaPasta(pasta)).toEqual([])
})
