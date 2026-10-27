import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { expect, test, type Page } from '@playwright/test'

async function cadastrar(page: Page, rotulo: string) {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill(`Pessoa ${rotulo}`)
  await page.getByLabel('Nome da agência').fill(`Agência ${rotulo}`)
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.dev`)
  await page.getByLabel('Senha', { exact: true }).fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
}

async function novoCliente(page: Page, nome: string) {
  await page.goto('/clientes/novo')
  await expect(page.getByRole('heading', { name: 'Novo cliente' })).toBeVisible()
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  await page.getByRole('button', { name: 'Salvar cliente' }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
}

async function escolherCliente(page: Page, busca: string, nome: string) {
  await page.getByLabel(/Buscar cliente/).fill(busca)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('link', { name: new RegExp(nome) }).click()
  await expect(page.getByText(`Reserva para ${nome}`)).toBeVisible()
}

test('reservations: seat lock, custom total, cancel, capacity guard, isolation', async ({ page, browser }) => {
  await cadastrar(page, 'reservas')
  await novoCliente(page, 'Ana Souza')
  await novoCliente(page, 'Beto Lima')

  // Tour + departure with 3 seats at R$ 1.000,00
  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Lisboa clássica')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Lisboa clássica', level: 1 })).toBeVisible()
  const urlPasseio = page.url()
  await page.getByLabel('Data da saída').fill('2027-03-10')
  await page.getByLabel('Vagas (capacidade)').fill('3')
  await page.getByLabel('Preço por pessoa (R$)').fill('1.000,00')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await expect(page.getByText('Saída criada.')).toBeVisible()
  await page.getByRole('link', { name: /10\/03\/2027/ }).click()
  await expect(page.getByRole('heading', { name: 'Saída de 10/03/2027' })).toBeVisible()
  const urlSaida = page.url()
  await expect(page.getByText('Vagas: 0 reservadas de 3 · 3 livres')).toBeVisible()
  await expect(page.getByText('Nenhuma reserva ainda.')).toBeVisible()

  // Reserve 2 for Ana: total defaults to people x price
  await escolherCliente(page, 'ana', 'Ana Souza')
  await page.getByLabel('Número de pessoas').fill('2')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()
  await expect(page.getByText('Vagas: 2 reservadas de 3 · 1 livres')).toBeVisible()
  const reservaAna = page.getByRole('listitem').filter({ hasText: 'Ana Souza' })
  await expect(reservaAna).toContainText('2 pessoas · R$ 2.000,00')

  // The seat lock: 2 more people do not fit (1 free); validation messages too
  await escolherCliente(page, 'beto', 'Beto Lima')
  await page.getByLabel('Número de pessoas').fill('2')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Não há vagas suficientes nesta saída.')).toBeVisible()
  await page.getByLabel('Número de pessoas').fill('0')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Informe de 1 a 500 pessoas.')).toBeVisible()
  await page.getByLabel('Número de pessoas').fill('1')
  await page.getByLabel('Valor do passeio (R$)').fill('abc')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Digite o valor total')).toBeVisible()

  // 1 person with a discount fills the departure
  await page.getByLabel('Número de pessoas').fill('1')
  await page.getByLabel('Valor do passeio (R$)').fill('800,00')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Vagas: 3 reservadas de 3 · 0 livres')).toBeVisible()
  await expect(page.getByText('Lotada', { exact: true })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Beto Lima' })).toContainText('1 pessoa · R$ 800,00')
  await expect(page.getByText('Saída lotada: cancele uma reserva para abrir vaga.')).toBeVisible()

  // The tour page shows the real seats
  await page.goto(urlPasseio)
  await expect(page.getByRole('link', { name: /10\/03\/2027/ })).toContainText('Vagas: 3 / 3')
  await expect(page.getByRole('link', { name: /10\/03\/2027/ })).toContainText('Lotada')

  // Capacity cannot drop below the sold seats; a departure with reservations cannot be deleted
  await page.goto(urlSaida)
  await page.getByLabel('Vagas (capacidade)').fill('2')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('A capacidade não pode ser menor que as vagas já reservadas.')).toBeVisible()
  await page.getByRole('button', { name: 'Excluir saída' }).click()
  await page.getByRole('button', { name: 'Excluir mesmo' }).click()
  await expect(page.getByText('Esta saída já tem reservas.')).toBeVisible()

  // Cancel Ana's reservation (inline confirmation): seats return, history stays
  await page.goto(urlSaida)
  await reservaAna.getByRole('button', { name: 'Cancelar reserva', exact: true }).click()
  await reservaAna.getByRole('button', { name: 'Voltar' }).click()
  await expect(page.getByText('Vagas: 3 reservadas de 3 · 0 livres')).toBeVisible()
  await reservaAna.getByRole('button', { name: 'Cancelar reserva', exact: true }).click()
  await reservaAna.getByRole('button', { name: 'Cancelar reserva mesmo' }).click()
  await expect(page.getByText('Vagas: 1 reservadas de 3 · 2 livres')).toBeVisible()
  await expect(reservaAna).toContainText('Cancelada')
  await expect(reservaAna.getByRole('button', { name: 'Cancelar reserva' })).toHaveCount(0)

  // Closing the departure stops new reservations
  await page.getByLabel('Situação').selectOption('encerrada')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Alterações salvas.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Esta saída não está aberta para reservas.')).toBeVisible()

  // Another agency cannot see it
  const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const outra = await contexto.newPage()
  await cadastrar(outra, 'outra-reservas')
  await outra.goto(urlSaida)
  await expect(outra.getByText('could not be found')).toBeVisible()
  await contexto.close()
})

test('undoing an import is refused when an imported client already has a reservation', async ({ page }) => {
  await cadastrar(page, 'desfazer')

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Clientes')
  ws.addRow(['Nome*', 'WhatsApp'])
  ws.addRow(['Cliente Importada', '(11) 99999-0707'])
  const arquivo = join(mkdtempSync(join(tmpdir(), 'crtour-e2e-')), 'um.xlsx')
  writeFileSync(arquivo, Buffer.from(await wb.xlsx.writeBuffer()))
  await page.goto('/importar')
  await page.getByLabel(/Planilha/).setInputFiles(arquivo)
  await page.getByRole('button', { name: 'Conferir planilha' }).click()
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await expect(page.getByText('Importação concluída')).toBeVisible()

  await page.goto('/passeios/novo')
  await page.getByLabel('Nome do passeio').fill('Passeio X')
  await page.getByRole('button', { name: 'Salvar passeio' }).click()
  await expect(page.getByRole('heading', { name: 'Passeio X', level: 1 })).toBeVisible()
  await page.getByLabel('Data da saída').fill('2027-08-01')
  await page.getByLabel('Vagas (capacidade)').fill('4')
  await page.getByLabel('Preço por pessoa (R$)').fill('500')
  await page.getByRole('button', { name: 'Criar saída' }).click()
  await page.getByRole('link', { name: /01\/08\/2027/ }).click()
  await escolherCliente(page, 'importada', 'Cliente Importada')
  await page.getByRole('button', { name: 'Reservar' }).click()
  await expect(page.getByText('Reserva feita.')).toBeVisible()

  await page.goto('/importar')
  await page.getByRole('button', { name: 'Desfazer importação' }).click()
  await page.getByRole('button', { name: 'Apagar mesmo' }).click()
  await expect(page.getByText('Alguns clientes desta importação já têm reservas ou negociações e não podem ser apagados.')).toBeVisible()
  await page.goto('/')
  await expect(page.getByText('Cliente Importada')).toBeVisible() // nothing was deleted
})
