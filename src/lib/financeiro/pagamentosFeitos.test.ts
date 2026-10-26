import { describe, expect, it } from 'vitest'
import type { LinhaAPagar } from '@/lib/contas/contas'
import { acertoPorVendedor, agruparRepasses, comissaoPagaSchema, lerLote } from './pagamentosFeitos'

const HOJE = '2026-10-26'
const V1 = '5b3f1c2a-1d2e-4f50-8a6b-7c8d9e0f1a2b'
const V2 = '6c4a2d3b-2e3f-4a51-9b7c-8d9e0f1a2b3c'

describe('acertoPorVendedor (R149)', () => {
  it('compares what is due with what was paid, per seller', () => {
    const devidas = [{ vendedorId: V1, total: 12500 }, { vendedorId: V2, total: 3000 }, { vendedorId: null, total: 900 }]
    const pagas = [{ vendedor_id: V1, valor_centavos: 10000 }, { vendedor_id: V2, valor_centavos: 3500 }]
    expect(acertoPorVendedor(devidas, pagas)).toEqual([
      { vendedorId: V1, devido: 12500, pago: 10000, aAcertar: 2500 },
      { vendedorId: V2, devido: 3000, pago: 3500, aAcertar: -500 },
    ])
  })

  it('keeps a seller who was paid in a month where nothing is due anymore (reversed reservation)', () => {
    expect(acertoPorVendedor([], [{ vendedor_id: V1, valor_centavos: 2000 }])).toEqual([{ vendedorId: V1, devido: 0, pago: 2000, aAcertar: -2000 }])
  })
})

describe('comissaoPagaSchema', () => {
  const ok = { vendedor: V1, mes: '2026-10', valor: '125,00', data: HOJE, forma: 'pix' }
  it('reads a commission payment', () => {
    expect(comissaoPagaSchema(HOJE).parse(ok)).toEqual({ vendedor_id: V1, mes: '2026-10-01', valor_centavos: 12500, pago_em: HOJE, forma_pago: 'pix' })
  })
  it.each([
    ['no seller', { vendedor: '' }], ['bad month', { mes: '2026-13' }], ['zero', { valor: '0' }],
    ['future date', { data: '2026-10-27' }], ['unknown form', { forma: 'cheque' }],
  ])('rejects %s', (_n, p) => {
    expect(comissaoPagaSchema(HOJE).safeParse({ ...ok, ...p }).success).toBe(false)
  })
})

describe('repasses (R150)', () => {
  const l = (id: string, extra: Partial<LinhaAPagar>): LinhaAPagar => ({
    origem: 'conta', id, descricao: id, categoria: 'Outros', valor: 1000, vencimento: '2026-11-01', pagoEm: null,
    fornecedor: 'Viação Sol', fornecedorId: V1, parcela: null, href: '#', ...extra,
  })

  it('groups what is still to pay by supplier, biggest total first, leaving out paid lines and lines without supplier', () => {
    const grupos = agruparRepasses([
      l('a', { valor: 500 }), l('b', { origem: 'custo', valor: 2000 }), l('c', { pagoEm: '2026-10-01' }),
      l('d', { fornecedor: 'Hotel Mar', fornecedorId: V2, valor: 3000 }), l('e', { fornecedor: null, fornecedorId: null }),
    ])
    expect(grupos.map((g) => [g.fornecedor, g.total, g.linhas.map((x) => x.id)])).toEqual([
      ['Hotel Mar', 3000, ['d']],
      ['Viação Sol', 2500, ['a', 'b']],
    ])
  })

  it('needs at least one line, a past or today date and a form', () => {
    const fd = (pares: [string, string][]) => { const f = new FormData(); for (const [k, v] of pares) f.append(k, v); return f }
    expect(lerLote(fd([['item', `conta:${V1}`], ['item', `custo:${V2}`], ['data', HOJE], ['forma', 'pix']]), HOJE).data)
      .toEqual({ p_contas: [V1], p_custos: [V2], p_data: HOJE, p_forma: 'pix' })
    expect(lerLote(fd([['data', HOJE], ['forma', 'pix']]), HOJE).success).toBe(false)
    expect(lerLote(fd([['item', 'conta:x'], ['data', HOJE], ['forma', 'pix']]), HOJE).success).toBe(false)
    expect(lerLote(fd([['item', `conta:${V1}`], ['data', '2026-10-30'], ['forma', 'pix']]), HOJE).success).toBe(false)
  })
})
