import { describe, expect, test } from 'vitest'
import { REGRAS, lerPercentual, lerRegra, lerValorPorPessoa, rotuloDaRegra, totaisPorVendedor } from './comissao'

describe('lerRegra', () => {
  test('one of the three rules, or none', () => {
    expect(REGRAS.map((r) => r.valor)).toEqual(['percentual_vendedor', 'percentual_passeio', 'valor_por_pessoa'])
    expect(lerRegra('percentual_passeio')).toEqual({ ok: true, regra: 'percentual_passeio' })
    expect(lerRegra('')).toEqual({ ok: true, regra: null })
    expect(lerRegra('outra')).toEqual({ ok: false, erro: 'Escolha uma regra da lista.' })
  })
  test('labels', () => {
    expect(rotuloDaRegra('valor_por_pessoa')).toBe('Valor fixo por passageiro')
    expect(rotuloDaRegra(null)).toBe('Não usar comissão')
  })
})

describe('lerPercentual', () => {
  test.each([['5', 5], ['5,5', 5.5], ['12.25', 12.25], [' 0 ', 0], ['100', 100], ['', 0]])('%j -> %d', (e, s) => {
    expect(lerPercentual(e)).toEqual({ ok: true, valor: s })
  })
  test.each(['101', '-1', '5,555', 'abc', '1e2'])('refuses %j', (e) => {
    expect(lerPercentual(e)).toEqual({ ok: false, erro: 'Use um percentual de 0 a 100, com até 2 casas (ex.: 5 ou 7,5).' })
  })
})

describe('lerValorPorPessoa', () => {
  test('reais to cents; empty = 0', () => {
    expect(lerValorPorPessoa('50,00')).toEqual({ ok: true, valor: 5000 })
    expect(lerValorPorPessoa('')).toEqual({ ok: true, valor: 0 })
    expect(lerValorPorPessoa('abc')).toEqual({ ok: false, erro: 'Use um valor em reais (ex.: 50,00).' })
  })
})

describe('totaisPorVendedor', () => {
  test('sums by person, biggest first; no seller grouped as null', () => {
    const r = totaisPorVendedor([
      { vendedor_id: 'v', comissao_centavos: 1000 }, { vendedor_id: null, comissao_centavos: 300 },
      { vendedor_id: 'd', comissao_centavos: 5000 }, { vendedor_id: 'v', comissao_centavos: 500 },
    ])
    expect(r).toEqual([
      { vendedorId: 'd', quantidade: 1, total: 5000 }, { vendedorId: 'v', quantidade: 2, total: 1500 }, { vendedorId: null, quantidade: 1, total: 300 },
    ])
  })
})
