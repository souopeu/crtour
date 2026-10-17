import { describe, expect, test } from 'vitest'
import { calcularPainel, lerFiltrosPainel, metaSchema, progressoMeta, rotuloDoMes, type NegPainel } from './painel'

const n = (p: Partial<NegPainel>): NegPainel => ({
  etapa: 'interessado', valor: 0, previsto: 0, responsavelId: null, fechadoEm: null, etapaDesde: '2026-10-01T15:00:00Z',
  motivo: null, dataEsperada: null, etapaAntesDaPerda: null, ...p,
})

// Known data for October/2026 (Brazil time)
const DADOS: NegPainel[] = [
  n({ etapa: 'interessado', valor: 100_000, previsto: 10_000, dataEsperada: '2026-11-20' }),
  n({ etapa: 'orcamento', valor: 200_000, previsto: 60_000, dataEsperada: '2026-11-05', responsavelId: 'v' }),
  n({ etapa: 'reservado', valor: 300_000, previsto: 210_000, dataEsperada: '2026-09-30' }), // expected date already passed
  n({ etapa: 'reservado', valor: 50_000, previsto: 35_000 }), // no expected date
  n({ etapa: 'pago', valor: 400_000, previsto: 400_000, fechadoEm: '2026-10-10T15:00:00Z', responsavelId: 'v' }),
  n({ etapa: 'viajou', valor: 600_000, previsto: 600_000, fechadoEm: '2026-10-31T23:30:00-03:00' }), // still October in Brazil
  n({ etapa: 'pos_venda', valor: 999_000, previsto: 999_000, fechadoEm: '2026-09-15T15:00:00Z' }), // September
  n({ etapa: 'perdido', valor: 80_000, motivo: 'achou_caro', etapaDesde: '2026-10-05T15:00:00Z', etapaAntesDaPerda: 'orcamento' }),
  n({ etapa: 'perdido', valor: 20_000, motivo: 'achou_caro', etapaDesde: '2026-10-06T15:00:00Z', etapaAntesDaPerda: 'interessado' }),
  n({ etapa: 'perdido', valor: 70_000, motivo: 'sem_resposta', etapaDesde: '2026-10-07T15:00:00Z', etapaAntesDaPerda: 'reservado', responsavelId: 'v' }),
  n({ etapa: 'perdido', valor: 5_000, motivo: 'desistiu', etapaDesde: '2026-08-01T15:00:00Z', etapaAntesDaPerda: 'interessado' }), // August
]

describe('calcularPainel', () => {
  const p = calcularPainel(DADOS, '2026-10', '2026-10-17')

  test('open pipeline = open stages now (value and forecast)', () => {
    expect(p.pipeline).toEqual({ quantidade: 4, valor: 650_000, previsto: 315_000 })
  })
  test('effective revenue = won in the month (Brazil time), ticket = revenue ÷ won', () => {
    expect(p.receita).toEqual({ quantidade: 2, valor: 1_000_000, ticketMedio: 500_000 })
  })
  test('conversion = won ÷ (won + lost) in the month', () => {
    expect(p.conversao).toEqual({ ganhas: 2, perdidas: 3, taxa: 0.4 })
  })
  test('per stage, same totals as the kanban columns', () => {
    expect(p.porEtapa.find((e) => e.etapa === 'reservado')).toEqual({ etapa: 'reservado', quantidade: 2, valor: 350_000, previsto: 245_000 })
    expect(p.porEtapa.find((e) => e.etapa === 'perdido')).toEqual({ etapa: 'perdido', quantidade: 4, valor: 175_000, previsto: 0 })
    expect(p.porEtapa).toHaveLength(7)
  })
  test('funnel: how many reached each stage (lost ones count up to where they were) and the drop', () => {
    expect(p.funil.map((f) => [f.etapa, f.chegaram])).toEqual([
      ['interessado', 11], ['orcamento', 8], ['reservado', 6], ['pago', 3], ['viajou', 2], ['pos_venda', 1],
    ])
    expect(p.funil[0].queda).toBeNull()
    expect(p.funil[1].queda).toBeCloseTo(3 / 11)
    expect(p.funil[3].queda).toBeCloseTo(0.5)
  })
  test('losses by reason in the month, biggest first', () => {
    expect(p.perdas).toEqual([
      { motivo: 'achou_caro', quantidade: 2, valor: 100_000 },
      { motivo: 'sem_resposta', quantidade: 1, valor: 70_000 },
    ])
  })
  test('forecast by expected month: late, months in order, no date last', () => {
    expect(p.previsao).toEqual([
      { chave: 'atrasada', quantidade: 1, previsto: 210_000 },
      { chave: '2026-11', quantidade: 2, previsto: 70_000 },
      { chave: 'sem_data', quantidade: 1, previsto: 35_000 },
    ])
  })
  test('empty data', () => {
    const v = calcularPainel([], '2026-10', '2026-10-17')
    expect(v.vazio).toBe(true)
    expect(v.receita).toEqual({ quantidade: 0, valor: 0, ticketMedio: null })
    expect(v.conversao.taxa).toBeNull()
    expect(p.vazio).toBe(false)
  })
  test('a past month only looks at what closed in it', () => {
    const set = calcularPainel(DADOS, '2026-09', '2026-10-17')
    expect(set.receita).toEqual({ quantidade: 1, valor: 999_000, ticketMedio: 999_000 })
    expect(set.conversao).toEqual({ ganhas: 1, perdidas: 0, taxa: 1 })
  })
})

describe('lerFiltrosPainel', () => {
  const membros = ['v', 'd']
  test('defaults to this month and everyone', () => {
    expect(lerFiltrosPainel({}, '2026-10-17', membros)).toEqual({ mes: '2026-10', responsavel: null })
  })
  test('valid month and member', () => {
    expect(lerFiltrosPainel({ mes: '2026-03', responsavel: 'v' }, '2026-10-17', membros)).toEqual({ mes: '2026-03', responsavel: 'v' })
  })
  test('invalid values fall back', () => {
    expect(lerFiltrosPainel({ mes: '2026-13', responsavel: 'x' }, '2026-10-17', membros)).toEqual({ mes: '2026-10', responsavel: null })
    expect(lerFiltrosPainel({ mes: ['2026-03'], responsavel: ['v'] }, '2026-10-17', membros)).toEqual({ mes: '2026-10', responsavel: null })
  })
})

describe('progressoMeta', () => {
  test('share and what is missing', () => {
    expect(progressoMeta(1_000_000, 4_000_000)).toEqual({ fracao: 0.25, falta: 3_000_000 })
  })
  test('above the goal: nothing missing', () => {
    expect(progressoMeta(5_000_000, 4_000_000)).toEqual({ fracao: 1.25, falta: 0 })
  })
})

describe('metaSchema', () => {
  test('reais to cents, positive', () => {
    expect(metaSchema.parse({ valor: '50.000,00' })).toEqual({ valor: 5_000_000 })
    const r = metaSchema.safeParse({ valor: '0' })
    expect(r.success).toBe(false)
    expect(metaSchema.safeParse({ valor: 'abc' }).success).toBe(false)
  })
})

test('rotuloDoMes', () => {
  expect(rotuloDoMes('2026-03')).toBe('março de 2026')
})
