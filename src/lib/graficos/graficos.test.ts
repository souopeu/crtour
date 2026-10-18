import { describe, expect, test } from 'vitest'
import { legendaSituacao, mesesAte, proporcao } from './graficos'

describe('proporcao', () => {
  test('share of the largest value, in percent', () => {
    expect(proporcao(5, 10)).toBe(50)
    expect(proporcao(10, 10)).toBe(100)
  })
  test('zero or nothing to compare gives 0, never NaN or more than 100', () => {
    expect(proporcao(0, 10)).toBe(0)
    expect(proporcao(3, 0)).toBe(0)
    expect(proporcao(12, 10)).toBe(100)
    expect(proporcao(-1, 10)).toBe(0)
  })
})

describe('legendaSituacao', () => {
  test('counts with singular and plural', () => {
    expect(legendaSituacao({ vendidos: 3, perdidos: 1, emAberto: 2 })).toBe('3 vendidos · 1 perdido · 2 em aberto')
    expect(legendaSituacao({ vendidos: 1, perdidos: 0, emAberto: 0 })).toBe('1 vendido · 0 perdidos · 0 em aberto')
  })
})

describe('mesesAte', () => {
  test('the last n months ending at the given one, oldest first', () => {
    expect(mesesAte('2026-10', 3)).toEqual(['2026-08', '2026-09', '2026-10'])
  })
  test('crosses the year', () => {
    expect(mesesAte('2027-02', 4)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })
})
