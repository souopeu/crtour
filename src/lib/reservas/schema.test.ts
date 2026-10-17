import { describe, expect, test } from 'vitest'
import { mensagemDeErroReserva, reservaSchema } from './schema'

describe('reservaSchema', () => {
  test('converts people and an optional total in reais', () => {
    expect(reservaSchema.parse({ qtd: '3', valor: '2.700,00', observacao: ' quarto duplo ' })).toEqual({
      qtd_pessoas: 3, valor_total_centavos: 270000, observacao: 'quarto duplo',
    })
  })
  test('blank total and note become null (the database then uses people x price)', () => {
    expect(reservaSchema.parse({ qtd: '1', valor: '', observacao: '' })).toEqual({
      qtd_pessoas: 1, valor_total_centavos: null, observacao: null,
    })
  })
  test('a zero total is allowed (courtesy)', () => {
    expect(reservaSchema.parse({ qtd: '1', valor: '0', observacao: '' }).valor_total_centavos).toBe(0)
  })
  test.each([
    ['no people', { qtd: '' }],
    ['zero people', { qtd: '0' }],
    ['too many people', { qtd: '501' }],
    ['decimal people', { qtd: '1.5' }],
    ['bad total', { valor: 'muito' }],
    ['long note', { observacao: 'a'.repeat(1001) }],
  ])('rejects %s', (_n, parcial) => {
    expect(reservaSchema.safeParse({ qtd: '2', valor: '', observacao: '', ...parcial }).success).toBe(false)
  })
})

describe('mensagemDeErroReserva', () => {
  test.each([
    ['CR001', /vagas/i],
    ['CR002', /não está aberta/i],
    ['CR003', /capacidade/i],
    ['CR004', /já estava cancelada/i],
    ['CR005', /lugares/i],
    ['CR006', /está cancelada/i],
    ['23503', /cliente/i],
    ['42501', /acesso/i],
    ['22003', /valor/i],
    ['23514', /pessoas/i],
  ])('translates %s', (codigo, esperado) => {
    expect(mensagemDeErroReserva(codigo)).toMatch(esperado)
  })
  test('unknown codes get a generic message without technical detail', () => {
    expect(mensagemDeErroReserva('XX999')).toMatch(/tente novamente/i)
    expect(mensagemDeErroReserva(undefined)).toMatch(/tente novamente/i)
  })
})
