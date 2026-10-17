import { describe, expect, test } from 'vitest'
import { separarLinhas } from './analise'
import { gerarPlanilhaDemo } from './demo'
import { lerPlanilha } from './planilha'

describe('gerarPlanilhaDemo', () => {
  test('the clean demo file imports without errors and has realistic variety', async () => {
    const r = await lerPlanilha(await gerarPlanilhaDemo(), 'demo.xlsx')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.colunasIgnoradas).toEqual([])
    const { validas, erros } = separarLinhas(r.linhas)
    expect(erros).toEqual([])
    expect(validas.length).toBeGreaterThanOrEqual(30)

    const consentimentos = new Set(validas.map((l) => l.consentimento_whatsapp))
    expect(consentimentos).toEqual(new Set(['aceitou', 'nao_informado', 'pediu_saida']))
    expect(new Set(validas.map((l) => l.origem).filter(Boolean)).size).toBeGreaterThanOrEqual(4)
    expect(new Set(validas.map((l) => l.cidade).filter(Boolean)).size).toBeGreaterThanOrEqual(4)
    expect(new Set(validas.flatMap((l) => l.etiquetas)).size).toBeGreaterThanOrEqual(5)

    // no duplicated phone numbers (the demo must not trigger the duplicate rule)
    const fones = validas.map((l) => l.whatsapp).filter(Boolean)
    expect(new Set(fones).size).toBe(fones.length)
  })

  test('the error demo has exactly three bad rows, reported with Excel row numbers', async () => {
    const r = await lerPlanilha(await gerarPlanilhaDemo({ comErros: true }), 'demo-erros.xlsx')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const { validas, erros } = separarLinhas(r.linhas)
    expect(erros).toHaveLength(3)
    expect(erros.map((e) => e.linha)).toEqual([...erros.map((e) => e.linha)].sort((a, b) => a - b))
    expect(validas.length).toBeGreaterThanOrEqual(30)
  })

  test('uses clearly fictional contacts', async () => {
    const r = await lerPlanilha(await gerarPlanilhaDemo(), 'demo.xlsx')
    if (!r.ok) throw new Error('unreadable')
    for (const l of r.linhas) {
      expect(String(l.celulas.email ?? '')).toMatch(/@exemplo\.com\.br$|^$/)
    }
  })
})
