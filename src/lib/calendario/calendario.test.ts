import { describe, expect, it } from 'vitest'
import {
  gradeDoMes, hrefAlternar, hrefItem, hrefMes, lerMes, lerOcultos, mesVizinho, porDia, rotuloMes, textoVagas, type ItemCalendario,
} from './calendario'

describe('textoVagas (R136)', () => {
  it('names the seats and keeps what is left to organise after them', () => {
    expect(textoVagas('2/10')).toBe('2/10 vagas')
    expect(textoVagas('2/10 · 1 a organizar')).toBe('2/10 vagas · 1 a organizar')
    expect(textoVagas(null)).toBe('')
  })
})

const item = (dia: string, tipo: ItemCalendario['tipo'], titulo = 'x'): ItemCalendario =>
  ({ dia, tipo, id: 'i1', titulo, detalhe: null, valor_centavos: null, situacao: null })

describe('lerMes', () => {
  it('accepts YYYY-MM and falls back to the current month', () => {
    expect(lerMes('2030-11', '2026-10-18')).toBe('2030-11')
    for (const ruim of [undefined, '', '2030-13', '2030-1', 'abc', '2030-11-01']) expect(lerMes(ruim, '2026-10-18')).toBe('2026-10')
    expect(lerMes(['2030-02', '2030-03'], '2026-10-18')).toBe('2030-02')
  })
})

describe('mesVizinho', () => {
  it('crosses year boundaries', () => {
    expect(mesVizinho('2030-12', 1)).toBe('2031-01')
    expect(mesVizinho('2030-01', -1)).toBe('2029-12')
  })
})

describe('gradeDoMes', () => {
  it('starts on Monday and ends on Sunday, in whole weeks', () => {
    const g = gradeDoMes('2030-11') // 1/11/2030 is a Friday; 30/11 a Saturday
    expect(g.inicio).toBe('2030-10-28')
    expect(g.fim).toBe('2030-12-01')
    expect(g.semanas).toHaveLength(5)
    expect(g.semanas.every((s) => s.length === 7)).toBe(true)
  })

  it('handles a month that starts on Monday and February of a leap year', () => {
    expect(gradeDoMes('2027-02').inicio).toBe('2027-02-01')
    const fev = gradeDoMes('2028-02')
    expect(fev.semanas.flat()).toContain('2028-02-29')
    expect(fev.semanas.length).toBeLessThanOrEqual(6)
  })
})

describe('porDia', () => {
  it('groups by day in a fixed type order', () => {
    const m = porDia([item('2030-11-10', 'custo'), item('2030-11-10', 'saida'), item('2030-11-11', 'saldo')])
    expect(m.get('2030-11-10')?.map((i) => i.tipo)).toEqual(['saida', 'custo'])
    expect(m.get('2030-11-12')).toBeUndefined()
  })
})

describe('filters and links', () => {
  it('reads hidden types, ignoring unknown ones', () => {
    expect([...lerOcultos('custo,xyz,aniversario')]).toEqual(['custo', 'aniversario'])
    expect(lerOcultos(undefined).size).toBe(0)
  })

  it('keeps the month and toggles one type', () => {
    expect(hrefAlternar('2030-11', new Set(), 'custo')).toBe('/calendario?mes=2030-11&sem=custo')
    expect(hrefAlternar('2030-11', new Set(['custo']), 'custo')).toBe('/calendario?mes=2030-11')
    expect(hrefMes('2030-12', new Set(['saldo']))).toBe('/calendario?mes=2030-12&sem=saldo')
  })

  it('opens the record behind each item', () => {
    expect(hrefItem({ tipo: 'saida', id: 's1' })).toBe('/saidas/s1')
    expect(hrefItem({ tipo: 'custo', id: 's1' })).toBe('/saidas/s1')
    expect(hrefItem({ tipo: 'saldo', id: 'r1' })).toBe('/reservas/r1')
    expect(hrefItem({ tipo: 'aniversario', id: 'c1' })).toBe('/clientes/c1')
  })

  it('names the month in Portuguese', () => {
    expect(rotuloMes('2030-03')).toBe('março de 2030')
  })
})
