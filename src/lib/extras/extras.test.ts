import { describe, expect, it } from 'vitest'
import { extraSchema, lerItens, quantidadeSugerida, totalComExtras } from './extras'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

describe('extraSchema', () => {
  it('turns the form into the row, with an optional cost', () => {
    expect(extraSchema.parse({ nome: ' Almoço ', preco: '40,00', custo: '', cobranca: 'por_pessoa', todos: '1', passeios: [] }))
      .toEqual({ nome: 'Almoço', preco_centavos: 4000, custo_centavos: null, cobranca: 'por_pessoa', todos_passeios: true, passeios: [] })
  })
  it('needs at least one tour when it is not for all of them', () => {
    const r = extraSchema.safeParse({ nome: 'Kit', preco: '9,00', custo: '5,00', cobranca: 'por_reserva', todos: '', passeios: [] })
    expect(r.error?.flatten().fieldErrors.passeios?.[0]).toMatch(/passeio/)
    expect(extraSchema.parse({ nome: 'Kit', preco: '9,00', custo: '5,00', cobranca: 'por_reserva', todos: '', passeios: [A] }))
      .toMatchObject({ todos_passeios: false, passeios: [A], custo_centavos: 500 })
  })
  it('refuses a missing name and a bad price', () => {
    const erros = extraSchema.safeParse({ nome: '', preco: 'caro', custo: '', cobranca: 'por_pessoa', todos: '1', passeios: [] }).error?.flatten().fieldErrors
    expect(Object.keys(erros ?? {})).toEqual(['nome', 'preco'])
  })
})

describe('lerItens', () => {
  it('keeps the extras with a quantity, in form order', () => {
    expect(lerItens([[`extra:${A}`, '2'], [`extra:${B}`, '0'], ['qtd', '3'], [`extra:${B}`, '']])).toEqual([{ extra: A, quantidade: 2 }])
  })
  it('refuses a bad quantity or id', () => {
    expect(lerItens([[`extra:${A}`, '-1']])).toBeNull()
    expect(lerItens([[`extra:${A}`, '501']])).toBeNull()
    expect(lerItens([['extra:x', '1']])).toBeNull()
  })
})

describe('quantidadeSugerida and totalComExtras', () => {
  it('suggests one per person or one per reservation', () => {
    expect(quantidadeSugerida('por_pessoa', 4)).toBe(4)
    expect(quantidadeSugerida('por_reserva', 4)).toBe(1)
  })
  it('adds the extras to the tour value', () => {
    expect(totalComExtras(20000, [{ preco_centavos: 4000, quantidade: 2 }, { preco_centavos: 1500, quantidade: 1 }])).toBe(29500)
  })
})
