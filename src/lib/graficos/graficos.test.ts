import { describe, expect, test } from 'vitest'
import { arcoSemicirculo, fatiasPizza, legendaSituacao, mesesAte, pontoNoSemicirculo, pontosLinha, proporcao } from './graficos'

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

describe('R120 gauge, pie and line geometry', () => {
  test('gauge runs from the left over the top to the right, clamped', () => {
    expect(pontoNoSemicirculo(100, 100, 50, 0)).toEqual({ x: 50, y: 100 })
    expect(pontoNoSemicirculo(100, 100, 50, 0.5)).toEqual({ x: 100, y: 50 })
    expect(pontoNoSemicirculo(100, 100, 50, 1)).toEqual({ x: 150, y: 100 })
    expect(pontoNoSemicirculo(100, 100, 50, 2)).toEqual({ x: 150, y: 100 })
    expect(arcoSemicirculo(100, 100, 50, 0, 1)).toBe('M 50 100 A 50 50 0 0 1 150 100')
  })
  test('pie slices share the whole, skip zeros and draw a lone 100% as a circle', () => {
    const f = fatiasPizza([2, 0, 2], 50, 50, 40)
    expect(f.map((x) => x.fracao)).toEqual([0.5, 0, 0.5])
    expect(f[0].caminho).toBe('M 50 50 L 50 10 A 40 40 0 0 1 50 90 Z')
    expect(f[1].caminho).toBe('')
    expect(fatiasPizza([3], 50, 50, 40)[0].caminho).toContain('A 40 40 0 1 1 50 90')
    expect(fatiasPizza([0, 0], 50, 50, 40).every((x) => x.caminho === '')).toBe(true)
    expect(fatiasPizza([3, 1], 50, 50, 40)[0].caminho).toContain('0 1 1') // over half: large arc
  })
  test('line spreads points and puts the highest at the top', () => {
    expect(pontosLinha([0, 50, 100], 200, 80)).toEqual([{ x: 0, y: 80 }, { x: 100, y: 40 }, { x: 200, y: 0 }])
    expect(pontosLinha([5], 200, 80)).toEqual([{ x: 100, y: 0 }])
    expect(pontosLinha([0, 0], 200, 80)).toEqual([{ x: 0, y: 80 }, { x: 200, y: 80 }])
  })
})
