import { describe, expect, test } from 'vitest'
import { ehBrasil, normalizarPais, rotuloLocal, UFS } from './local'

describe('local (R126)', () => {
  test('27 UFs', () => expect(new Set(UFS).size).toBe(27))
  test('blank or any spelling of Brasil is the default country', () => {
    for (const p of ['', ' ', 'brasil', 'BRAZIL', ' Brasil ']) expect(normalizarPais(p)).toBe('Brasil')
    expect(normalizarPais('  Estados   Unidos ')).toBe('Estados Unidos')
    expect(ehBrasil('Portugal')).toBe(false)
  })
  test('label leaves empty parts and Brasil out', () => {
    expect(rotuloLocal('São Paulo', 'SP', 'Brasil')).toBe('São Paulo · SP')
    expect(rotuloLocal('Lisboa', null, 'Portugal')).toBe('Lisboa · Portugal')
    expect(rotuloLocal(null, null, 'Brasil')).toBe('')
  })
})
