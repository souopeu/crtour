import { describe, expect, test } from 'vitest'
import { separarLinhas } from './analise'

describe('separarLinhas', () => {
  test('splits valid rows from rows with errors, keeping Excel row numbers', () => {
    const r = separarLinhas([
      { numero: 2, celulas: { nome: 'Ana', whatsapp: '(11) 99999-0001' } },
      { numero: 3, celulas: { nome: '', whatsapp: '123', email: 'x' } },
      { numero: 4, celulas: { nome: 'Beto' } },
    ])
    expect(r.validas.map((l) => l.linha)).toEqual([2, 4])
    expect(r.erros).toHaveLength(1)
    expect(r.erros[0].linha).toBe(3)
    expect(r.erros[0].mensagens.length).toBeGreaterThanOrEqual(3)
  })
})
