import { describe, expect, test } from 'vitest'
import { passeioSchema, saidaSchema } from './schema'

describe('passeioSchema', () => {
  test('requires a name and nulls the optional fields', () => {
    expect(passeioSchema.parse({ nome: '  Lisboa clássica ', destino: '', descricao: '', inclui: '', nao_inclui: '' }))
      .toEqual({ nome: 'Lisboa clássica', destino: null, descricao: null, inclui: null, nao_inclui: null })
  })
  test('keeps what is and is not included (used by proposals)', () => {
    expect(passeioSchema.parse({ nome: 'A', destino: '', descricao: '', inclui: ' Aéreo ', nao_inclui: 'Refeições' })).toMatchObject({ inclui: 'Aéreo', nao_inclui: 'Refeições' })
    expect(passeioSchema.safeParse({ nome: 'A', destino: '', descricao: '', inclui: 'a'.repeat(2001), nao_inclui: '' }).success).toBe(false)
  })
  test.each([
    ['blank name', { nome: '  ', destino: '', descricao: '', inclui: '', nao_inclui: '' }],
    ['long name', { nome: 'a'.repeat(121), destino: '', descricao: '', inclui: '', nao_inclui: '' }],
    ['long destination', { nome: 'A', destino: 'a'.repeat(121), descricao: '', inclui: '', nao_inclui: '' }],
    ['long description', { nome: 'A', destino: '', descricao: 'a'.repeat(1001), inclui: '', nao_inclui: '' }],
  ])('rejects %s', (_n, dados) => {
    expect(passeioSchema.safeParse(dados).success).toBe(false)
  })
})

describe('saidaSchema', () => {
  const ok = { data: '2027-03-10', capacidade: '12', preco: '8.900,00' }
  test('converts capacity and price', () => {
    expect(saidaSchema.parse(ok)).toEqual({ data: '2027-03-10', capacidade: 12, preco_centavos: 890000, situacao: 'aberta' })
  })
  test('accepts a valid status and rejects an unknown one', () => {
    expect(saidaSchema.parse({ ...ok, situacao: 'cancelada' }).situacao).toBe('cancelada')
    expect(saidaSchema.safeParse({ ...ok, situacao: 'lotada' }).success).toBe(false)
  })
  test('a free departure is allowed', () => {
    expect(saidaSchema.parse({ ...ok, preco: '0' }).preco_centavos).toBe(0)
  })
  test.each([
    ['no date', { data: '' }],
    ['impossible date', { data: '2027-02-31' }],
    ['malformed date', { data: '10/03/2027' }],
    ['zero capacity', { capacidade: '0' }],
    ['huge capacity', { capacidade: '501' }],
    ['decimal capacity', { capacidade: '2.5' }],
    ['empty capacity', { capacidade: '' }],
    ['bad price', { preco: 'caro' }],
    ['empty price', { preco: '' }],
  ])('rejects %s', (_n, parcial) => {
    expect(saidaSchema.safeParse({ ...ok, ...parcial }).success).toBe(false)
  })
})
