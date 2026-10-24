import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { describe, expect, test } from 'vitest'
import { IMPORTACAO } from './config'
import { lerPlanilha, tamanhoDescomprimido } from './planilha'

async function xlsx(linhas: unknown[][], nomeAba = 'Clientes') {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(nomeAba)
  linhas.forEach((l) => ws.addRow(l))
  return Buffer.from(await wb.xlsx.writeBuffer())
}

describe('lerPlanilha (xlsx)', () => {
  test('maps columns by header and numbers rows as in Excel', async () => {
    const buf = await xlsx([
      ['Nome*', 'Telefone', 'Coluna extra', 'Etiquetas'],
      ['Ana', '(11) 99999-0001', 'x', 'Europa'],
      [null, null, null, null],
      ['Beto', null, 'y', null],
    ])
    const r = await lerPlanilha(buf, 'clientes.xlsx')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.linhas.map((l) => l.numero)).toEqual([2, 4])
      expect(r.linhas[0].celulas).toMatchObject({ nome: 'Ana', whatsapp: '(11) 99999-0001', etiquetas: 'Europa' })
      expect(r.colunasIgnoradas).toEqual(['Coluna extra'])
    }
  })

  test('keeps real Date cells', async () => {
    const buf = await xlsx([['Nome', 'Aniversário'], ['Ana', new Date(Date.UTC(1990, 4, 17))]])
    const r = await lerPlanilha(buf, 'a.xlsx')
    expect(r.ok && r.linhas[0].celulas.aniversario).toEqual(new Date(Date.UTC(1990, 4, 17)))
  })

  test('prefers the sheet named Clientes', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('Leia-me').addRow(['texto'])
    const ws = wb.addWorksheet('Clientes')
    ws.addRow(['Nome'])
    ws.addRow(['Ana'])
    const r = await lerPlanilha(Buffer.from(await wb.xlsx.writeBuffer()), 'a.xlsx')
    expect(r.ok && r.linhas).toHaveLength(1)
  })

  test('requires a Nome column', async () => {
    const r = await lerPlanilha(await xlsx([['Telefone'], ['1']]), 'a.xlsx')
    expect(r).toEqual({ ok: false, erro: expect.stringMatching(/coluna "Nome"/i) })
  })

  test('refuses files that are not spreadsheets', async () => {
    const r = await lerPlanilha(Buffer.from('MZ binário qualquer'), 'virus.xlsx')
    expect(r.ok).toBe(false)
  })

  test('refuses too many rows and too big files', async () => {
    const muitas = [['Nome'], ...Array.from({ length: IMPORTACAO.arquivo.maxLinhas + 1 }, (_, i) => [`N${i}`])]
    expect((await lerPlanilha(await xlsx(muitas), 'a.xlsx')).ok).toBe(false)
    expect((await lerPlanilha(Buffer.alloc(IMPORTACAO.arquivo.maxBytes + 1), 'a.xlsx')).ok).toBe(false)
  })
})

describe('lerPlanilha (csv)', () => {
  test('reads semicolon CSV with quotes, BOM and accents', async () => {
    const csv = '﻿Nome;WhatsApp;Restrições\r\n"Souza; Ana";(11) 99999-0001;"disse ""oi"""\r\nBeto;;\r\n'
    const r = await lerPlanilha(Buffer.from(csv, 'utf8'), 'c.csv')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.linhas.map((l) => l.numero)).toEqual([2, 3])
      expect(r.linhas[0].celulas).toMatchObject({ nome: 'Souza; Ana', whatsapp: '(11) 99999-0001', restricoes: 'disse "oi"' })
    }
  })

  test('detects comma delimiter', async () => {
    const r = await lerPlanilha(Buffer.from('Nome,Cidade\nAna,Santos\n'), 'c.csv')
    expect(r.ok && r.linhas[0].celulas).toMatchObject({ nome: 'Ana', cidade: 'Santos' })
  })
})

describe('zip bomb guard', () => {
  async function zipDe(bytes: number) {
    const zip = new JSZip()
    zip.file('xl/worksheets/sheet1.xml', Buffer.alloc(bytes, 'a'))
    return Buffer.from(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }))
  }

  test('reads the declared uncompressed size from the zip directory', async () => {
    expect(await xlsx([['Nome'], ['Ana']]).then(tamanhoDescomprimido)).toBeGreaterThan(0)
    expect(tamanhoDescomprimido(await zipDe(1_000_000))).toBe(1_000_000)
  })

  test('refuses a small file that expands to a huge one', async () => {
    const bomba = await zipDe(IMPORTACAO.arquivo.maxDescomprimidoBytes + 1)
    expect(bomba.length).toBeLessThan(IMPORTACAO.arquivo.maxBytes)
    const r = await lerPlanilha(bomba, 'bomba.xlsx')
    expect(r).toEqual({ ok: false, erro: expect.stringMatching(/grande demais/i) })
  }, 30_000) // compressing 50 MB takes <1 s alone but can pass 5 s when the whole suite runs in parallel

  test('treats a malformed directory as unsafe', () => {
    expect(tamanhoDescomprimido(Buffer.from('PK\u0003\u0004 sem diretório'))).toBe(Infinity)
  })
})
