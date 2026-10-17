import { describe, expect, test } from 'vitest'
import { centavosParaCampo, formatarReais, reaisParaCentavos } from './dinheiro'

describe('reaisParaCentavos', () => {
  test.each([
    ['8900', 890000],
    ['8.900,00', 890000],
    ['R$ 8.900,50', 890050],
    ['1234,5', 123450],
    ['1234.56', 123456],
    ['0', 0],
    ['0,99', 99],
    ['  45 ', 4500],
    ['1.234.567,89', 123456789],
  ])('parses %s', (entrada, esperado) => {
    expect(reaisParaCentavos(entrada)).toBe(esperado)
  })

  test.each(['', '   ', 'abc', '-5', '1,234,56', '12,345', '1.2.3', '10000000,00', 'R$', '1e3', '0,001'])('rejects %j', (entrada) => {
    expect(reaisParaCentavos(entrada)).toBeNull()
  })

  test('never goes through floating point (no 0.1+0.2 drift)', () => {
    expect(reaisParaCentavos('19,99')).toBe(1999)
    expect(reaisParaCentavos('1.005,05')).toBe(100505)
  })
})

describe('formatarReais', () => {
  test.each([
    [890000, 'R$ 8.900,00'],
    [99, 'R$ 0,99'],
    [0, 'R$ 0,00'],
    [123456789, 'R$ 1.234.567,89'],
  ])('%i -> %s', (centavos, esperado) => {
    expect(formatarReais(centavos).replace(/ /g, ' ')).toBe(esperado)
  })
})

describe('centavosParaCampo', () => {
  test('writes the value the way the price field accepts it back', () => {
    expect(centavosParaCampo(890000)).toBe('8900,00')
    expect(centavosParaCampo(99)).toBe('0,99')
    expect(centavosParaCampo(0)).toBe('0,00')
    for (const c of [0, 99, 100, 890050, 123456789]) expect(reaisParaCentavos(centavosParaCampo(c))).toBe(c)
  })
})
