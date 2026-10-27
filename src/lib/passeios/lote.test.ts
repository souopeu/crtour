import { describe, expect, it } from 'vitest'
import { alteracaoLoteSchema, contarLote, datasDoLote, loteSchema, resumoDaAlteracao } from './lote'

describe('datasDoLote', () => {
  it('keeps only the chosen weekdays in the period, inclusive', () => {
    // 2030-01-07 is a Monday
    expect(datasDoLote('2030-01-07', '2030-01-13', [1, 3, 5])).toEqual(['2030-01-07', '2030-01-09', '2030-01-11'])
  })
  it('crosses months and leap days', () => {
    expect(datasDoLote('2028-02-28', '2028-03-01', [0, 1, 2, 3, 4, 5, 6])).toEqual(['2028-02-28', '2028-02-29', '2028-03-01'])
  })
  it('returns nothing for an inverted period', () => {
    expect(datasDoLote('2030-01-10', '2030-01-01', [1])).toEqual([])
  })
})

describe('contarLote', () => {
  it('counts new and skipped departures by date and time', () => {
    const existentes = [{ data: '2030-01-07', horario: '08:00:00' }, { data: '2030-01-09', horario: null }]
    expect(contarLote(['2030-01-07', '2030-01-09'], ['08:00', '14:00'], existentes)).toEqual({ novas: 3, puladas: 1 })
    expect(contarLote(['2030-01-07', '2030-01-09'], [], existentes)).toEqual({ novas: 1, puladas: 1 })
  })
})

const base = { de: '2030-01-07', ate: '2030-01-13', dias: ['1', '3'], horarios: '14:00, 08:00, 08:00', capacidade: '12', preco: '90,00', veiculo: '' }

describe('loteSchema', () => {
  it('turns the form into dates, sorted unique times and cents', () => {
    const r = loteSchema('2030-01-01').parse(base)
    expect(r).toEqual({ datas: ['2030-01-07', '2030-01-09'], horarios: ['08:00', '14:00'], capacidade: 12, preco_centavos: 9000, veiculo_id: null })
  })
  it('accepts no time at all', () => {
    expect(loteSchema('2030-01-01').parse({ ...base, horarios: ' ' }).horarios).toEqual([])
  })
  it('refuses a bad time, a past start, a period over 366 days and no weekday', () => {
    const erros = (v: object) => Object.keys(loteSchema('2030-01-01').safeParse({ ...base, ...v }).error?.flatten().fieldErrors ?? {})
    expect(erros({ horarios: '8h' })).toEqual(['horarios'])
    expect(erros({ de: '2029-12-31' })).toEqual(['de'])
    expect(erros({ ate: '2031-01-08' })).toEqual(['ate'])
    expect(erros({ dias: [] })).toEqual(['dias'])
  })
  it('refuses a batch with no date or over 500 departures', () => {
    const r1 = loteSchema('2030-01-01').safeParse({ ...base, ate: '2030-01-07', dias: ['3'] })
    const campos = (r: typeof r1) => (r.error?.flatten().fieldErrors ?? {}) as Record<string, string[] | undefined>
    expect(campos(r1).dias?.[0]).toMatch(/Nenhuma data/)
    const r2 = loteSchema('2030-01-01').safeParse({ ...base, ate: '2030-12-31', dias: ['0', '1', '2', '3', '4', '5', '6'] })
    expect(campos(r2).horarios?.[0]).toMatch(/500/)
  })
})

describe('alteracaoLoteSchema', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  it('needs a departure and a new price or capacity', () => {
    expect(alteracaoLoteSchema.parse({ saidas: [id], preco: '100,00', capacidade: '' })).toEqual({ saidas: [id], preco_centavos: 10000, capacidade: null })
    expect(alteracaoLoteSchema.safeParse({ saidas: [], preco: '1,00', capacidade: '' }).success).toBe(false)
    expect(alteracaoLoteSchema.safeParse({ saidas: [id], preco: '', capacidade: '' }).success).toBe(false)
    expect(alteracaoLoteSchema.safeParse({ saidas: [id], preco: '', capacidade: '0' }).success).toBe(false)
  })
})

describe('resumoDaAlteracao', () => {
  it('says how many changed and why the others did not', () => {
    expect(resumoDaAlteracao(3, [])).toBe('3 saídas alteradas.')
    expect(resumoDaAlteracao(3, [{ motivo: 'CR003' }, { motivo: 'passada' }])).toBe(
      '1 saída alterada. 2 ficaram de fora: 1 com mais vagas vendidas do que o novo número; 1 já passou.',
    )
  })
})
