import { describe, expect, test } from 'vitest'
import { converterLinha } from './linhas'
import { COLUNAS_MODELO, gerarModelo } from './modelo'
import { lerPlanilha } from './planilha'

describe('gerarModelo', () => {
  test('produces a spreadsheet our own importer accepts, with valid example rows', async () => {
    const buf = await gerarModelo()
    const r = await lerPlanilha(buf, 'modelo-importacao-crtour.xlsx')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.colunasIgnoradas).toEqual([])
    expect(r.linhas.length).toBeGreaterThanOrEqual(2)
    for (const l of r.linhas) expect(converterLinha(l.numero, l.celulas).ok).toBe(true)
  })

  test('marks the name column as required and lists every importable column', () => {
    expect(COLUNAS_MODELO[0]).toBe('Nome*')
    expect(COLUNAS_MODELO).toContain('Etiquetas')
    expect(COLUNAS_MODELO).toContain('Consentimento WhatsApp')
  })
})
