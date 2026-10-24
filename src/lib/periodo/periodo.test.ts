import { describe, expect, it } from 'vitest'
import { hrefPeriodo, lerPeriodo, somarDias } from './periodo'

const HOJE = '2026-10-24'

describe('somarDias', () => {
  it('moves across months and years by the calendar, not by the clock', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01')
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('lerPeriodo (R135)', () => {
  it('defaults to the coming departures', () => {
    expect(lerPeriodo({}, HOJE)).toEqual({ atalho: 'proximas', de: HOJE, ate: null })
  })

  it.each([
    ['hoje', { atalho: 'hoje', de: HOJE, ate: HOJE }],
    ['amanha', { atalho: 'amanha', de: '2026-10-25', ate: '2026-10-25' }],
    ['proximas', { atalho: 'proximas', de: HOJE, ate: null }],
    ['todas', { atalho: 'todas', de: null, ate: null }],
  ])('reads the shortcut %s', (periodo, esperado) => {
    expect(lerPeriodo({ periodo }, HOJE)).toEqual(esperado)
  })

  it('lets typed dates win over the shortcut', () => {
    expect(lerPeriodo({ periodo: 'hoje', de: '2026-11-01', ate: '2026-11-30' }, HOJE))
      .toEqual({ atalho: null, de: '2026-11-01', ate: '2026-11-30' })
    expect(lerPeriodo({ de: '2026-11-01' }, HOJE)).toEqual({ atalho: null, de: '2026-11-01', ate: null })
    expect(lerPeriodo({ ate: '2026-11-30' }, HOJE)).toEqual({ atalho: null, de: null, ate: '2026-11-30' })
  })

  it('swaps the dates when "até" comes before "a partir de"', () => {
    expect(lerPeriodo({ de: '2026-12-10', ate: '2026-12-01' }, HOJE)).toEqual({ atalho: null, de: '2026-12-01', ate: '2026-12-10' })
  })

  it('ignores anything that is not a known shortcut or a real date', () => {
    expect(lerPeriodo({ periodo: 'ontem' }, HOJE).atalho).toBe('proximas')
    expect(lerPeriodo({ de: '2026-02-30' }, HOJE)).toEqual({ atalho: 'proximas', de: HOJE, ate: null })
    expect(lerPeriodo({ de: ['2026-11-01', '2026-11-02'] }, HOJE).atalho).toBe('proximas')
    expect(lerPeriodo({ de: "2026-11-01' or 1=1" }, HOJE).atalho).toBe('proximas')
  })
})

describe('hrefPeriodo', () => {
  it('keeps the other filters and drops the typed dates', () => {
    expect(hrefPeriodo('/reservas', 'hoje', { aba: 'canceladas', de: '2026-11-01' })).toBe('/reservas?aba=canceladas&periodo=hoje')
  })

  it('leaves the default shortcut out of the address', () => {
    expect(hrefPeriodo('/reservas', 'proximas', {})).toBe('/reservas')
  })
})
