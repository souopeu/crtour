import { describe, expect, test } from 'vitest'
import { encontrarEtiqueta, nomeDeEtiqueta } from './etiquetas'

describe('nomeDeEtiqueta', () => {
  test('trims and collapses inner spaces', () => {
    expect(nomeDeEtiqueta('  Fernando   de  Noronha ')).toEqual({ ok: true, nome: 'Fernando de Noronha' })
  })
  test.each(['', '   ', 'a'.repeat(41)])('rejects %j', (entrada) => {
    expect(nomeDeEtiqueta(entrada).ok).toBe(false)
  })
})

describe('encontrarEtiqueta', () => {
  const lista = [
    { id: '1', nome: 'Europa' },
    { id: '2', nome: 'VIP' },
  ]
  test('matches ignoring case and accents-insensitive spacing', () => {
    expect(encontrarEtiqueta(lista, 'europa')?.id).toBe('1')
    expect(encontrarEtiqueta(lista, ' vip ')?.id).toBe('2')
  })
  test('returns undefined when missing', () => {
    expect(encontrarEtiqueta(lista, 'Praia')).toBeUndefined()
  })
})
