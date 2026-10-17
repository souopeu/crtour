import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { expect, test, type Page } from '@playwright/test'

async function cadastrar(page: Page, rotulo: string) {
  await page.goto('/cadastro')
  await page.getByLabel('Seu nome').fill(`Pessoa ${rotulo}`)
  await page.getByLabel('Nome da agência').fill(`Agência ${rotulo}`)
  await page.getByLabel('E-mail', { exact: true }).fill(`e2e-${rotulo}-${Date.now()}@teste.dev`)
  await page.getByLabel('Senha').fill('senha1234')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL('/')
}

async function planilha(nome: string, linhas: unknown[][]) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Clientes')
  linhas.forEach((l) => ws.addRow(l))
  const caminho = join(mkdtempSync(join(tmpdir(), 'crtour-e2e-')), nome)
  writeFileSync(caminho, Buffer.from(await wb.xlsx.writeBuffer()))
  return caminho
}

const CABECALHO = ['Nome*', 'WhatsApp', 'E-mail', 'Cidade', 'Origem', 'Etiquetas']

test('import: preview with row errors, import, duplicates, re-import blocked, undo', async ({ page }) => {
  await cadastrar(page, 'import')
  await page.goto('/importar')
  await expect(page.getByRole('heading', { name: 'Importar planilha' })).toBeVisible()

  // Template download works
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: /Baixar planilha-modelo/ }).click()
  expect((await download).suggestedFilename()).toBe('modelo-importacao-crtour.xlsx')

  const arquivo = await planilha('clientes.xlsx', [
    CABECALHO,
    ['Ana Souza', '(11) 99999-0001', 'ana@x.com', 'Santos', 'Instagram', 'Europa, VIP'],
    ['Beto Lima', '(21) 98888-0002', '', 'Rio de Janeiro', 'Indicação', 'Europa'],
    ['Ana Souza Repetida', '(11) 99999-0001', '', '', '', ''],
    ['', '123', 'x', '', 'TV', ''],
  ])

  await page.getByLabel(/Planilha/).setInputFiles(arquivo)
  await page.getByRole('button', { name: 'Conferir planilha' }).click()
  await expect(page.getByRole('heading', { name: /Conferência de clientes.xlsx/ })).toBeVisible()
  await expect(page.getByText('Linha 5:')).toBeVisible() // Excel row number of the bad row
  await expect(page.getByText('Origem inválida')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importar', exact: true })).toBeDisabled()

  // Fix the file: drop the bad row
  const corrigido = await planilha('clientes-ok.xlsx', [
    CABECALHO,
    ['Ana Souza', '(11) 99999-0001', 'ana@x.com', 'Santos', 'Instagram', 'Europa, VIP'],
    ['Beto Lima', '(21) 98888-0002', '', 'Rio de Janeiro', 'Indicação', 'Europa'],
    ['Ana Souza Repetida', '(11) 99999-0001', '', '', '', ''],
  ])
  await page.getByLabel(/Planilha/).setInputFiles(corrigido)
  await page.getByRole('button', { name: 'Conferir planilha' }).click()
  await expect(page.getByRole('heading', { name: /Conferência de clientes-ok.xlsx/ })).toBeVisible()
  const importar = page.getByRole('button', { name: 'Importar', exact: true })
  await expect(importar).toBeEnabled()
  await expect(page.getByText('Repetidos na planilha').locator('xpath=following-sibling::dd')).toHaveText('1')

  await importar.click()
  await expect(page.getByText('Importação concluída: 2 clientes criados e 1 ignorados.')).toBeVisible()
  await expect(page.getByText(/2 clientes criados · 1 ignorados/)).toBeVisible()

  // Clients and tags are in the list
  await page.goto('/')
  await expect(page.getByText('Mostrando 1–2 de 2')).toBeVisible()
  await page.getByLabel('Etiqueta').selectOption({ label: 'Europa' })
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await expect(page.getByText('Mostrando 1–2 de 2')).toBeVisible()

  // Same file again: blocked
  await page.goto('/importar')
  await page.getByLabel(/Planilha/).setInputFiles(corrigido)
  await page.getByRole('button', { name: 'Conferir planilha' }).click()
  await expect(page.getByText('Este arquivo já foi importado antes.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importar', exact: true })).toBeDisabled()

  // Existing clients are skipped in another file
  const outro = await planilha('outro.xlsx', [CABECALHO, ['Ana de novo', '(11) 99999-0001', '', '', '', ''], ['Caio Novo', '(31) 97777-0003', '', '', '', '']])
  await page.getByLabel(/Planilha/).setInputFiles(outro)
  await page.getByRole('button', { name: 'Conferir planilha' }).click()
  await expect(page.getByText('Já cadastrados').locator('xpath=following-sibling::dd')).toHaveText('1')
  await expect(page.getByText('Novos clientes').locator('xpath=following-sibling::dd')).toHaveText('1')

  // Undo with inline confirmation
  await page.getByRole('button', { name: 'Desfazer importação' }).click()
  await expect(page.getByText('Isso apaga os 2 clientes')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByText('Isso apaga os 2 clientes')).toHaveCount(0)
  await page.getByRole('button', { name: 'Desfazer importação' }).click()
  await page.getByRole('button', { name: 'Apagar mesmo' }).click()
  await expect(page.getByText('Nenhuma importação ainda.')).toBeVisible()

  await page.goto('/')
  await expect(page.getByText('Você ainda não tem clientes.')).toBeVisible()
})

test('import refuses a non-spreadsheet and a sheet without a Nome column', async ({ page }) => {
  await cadastrar(page, 'import2')
  await page.goto('/importar')

  const falso = join(mkdtempSync(join(tmpdir(), 'crtour-e2e-')), 'falso.xlsx')
  writeFileSync(falso, 'isto não é uma planilha')
  await page.getByLabel(/Planilha/).setInputFiles(falso)
  await page.getByRole('button', { name: 'Conferir planilha' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'não parece ser uma planilha' })).toBeVisible()

  const semNome = await planilha('sem-nome.xlsx', [['Telefone'], ['(11) 99999-0001']])
  await page.getByLabel(/Planilha/).setInputFiles(semNome)
  await page.getByRole('button', { name: 'Conferir planilha' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'coluna "Nome"' })).toBeVisible()
})
