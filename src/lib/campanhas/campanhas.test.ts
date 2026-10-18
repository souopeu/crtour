import { describe, expect, test } from 'vitest'
import { chaveDaCampanha, indicadores, lerFormCampanha, linkDaCampanha, periodoDoRelatorio } from './campanhas'

const fd = (campos: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

describe('chaveDaCampanha', () => {
  test('lower case and trimmed, the same rule the database matches with', () => {
    expect(chaveDaCampanha('  Verao 2027 ')).toBe('verao 2027')
  })
})

describe('lerFormCampanha', () => {
  test('reads name, channel, key, dates and spend', () => {
    const r = lerFormCampanha(fd({ nome: ' Verão Google ', canal: 'google', utm: 'Verao_2027', inicio: '2026-10-01', fim: '2026-10-31', gasto: '1.500,00' }))
    expect(r).toEqual({ ok: true, dados: { nome: 'Verão Google', canal: 'google', utm_campanha: 'verao_2027', inicio: '2026-10-01', fim: '2026-10-31', gasto_centavos: 150000 } })
  })
  test('end date and spend are optional', () => {
    const r = lerFormCampanha(fd({ nome: 'X', canal: 'meta', utm: 'x', inicio: '2026-10-01' }))
    expect(r.ok && r.dados).toMatchObject({ fim: null, gasto_centavos: 0 })
  })
  test('explains each problem', () => {
    const r = lerFormCampanha(fd({ nome: '', canal: 'tv', utm: '', inicio: '2026-10-10', fim: '2026-10-01', gasto: 'abc' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.campos).sort()).toEqual(['canal', 'fim', 'gasto', 'nome', 'utm'])
  })
})

describe('indicadores', () => {
  test('conversion, cost per lead, cost per sale and return', () => {
    expect(indicadores({ leads: 10, vendas: 2, valor_vendido_centavos: 600000, gasto_centavos: 100000 }))
      .toEqual({ conversao: 20, custoPorLeadCentavos: 10000, custoPorVendaCentavos: 50000, retorno: 6 })
  })
  test('nothing to divide by gives null, never a wrong number', () => {
    expect(indicadores({ leads: 0, vendas: 0, valor_vendido_centavos: 0, gasto_centavos: 0 }))
      .toEqual({ conversao: null, custoPorLeadCentavos: null, custoPorVendaCentavos: null, retorno: null })
  })
})

describe('linkDaCampanha', () => {
  test('form link with origin, source and campaign tags', () => {
    expect(linkDaCampanha('https://x.com/f/abc', 'google', 'verao 2027'))
      .toBe('https://x.com/f/abc?o=anuncio&utm_source=google&utm_medium=cpc&utm_campaign=verao+2027')
    expect(linkDaCampanha('https://x.com/f/abc', 'meta', 'v')).toContain('utm_source=meta&utm_medium=paid_social')
  })
})

describe('periodoDoRelatorio', () => {
  test('defaults to the last 30 days and accepts a valid range', () => {
    expect(periodoDoRelatorio({}, '2026-10-18')).toEqual({ de: '2026-09-18', ate: '2026-10-18' })
    expect(periodoDoRelatorio({ de: '2026-01-01', ate: '2026-03-31' }, '2026-10-18')).toEqual({ de: '2026-01-01', ate: '2026-03-31' })
  })
  test('an inverted or broken range falls back to the default', () => {
    expect(periodoDoRelatorio({ de: '2026-05-01', ate: '2026-04-01' }, '2026-10-18')).toEqual({ de: '2026-09-18', ate: '2026-10-18' })
    expect(periodoDoRelatorio({ de: 'x' }, '2026-10-18').de).toBe('2026-09-18')
  })
})
