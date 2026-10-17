import { describe, expect, test } from 'vitest'
import { diasDesde, estaParada, limiteSemContato, limitesSchema, separarAtividades, textoHaDias } from './hoje'

describe('diasDesde', () => {
  test('counts Brazilian calendar days, not 24h blocks', () => {
    expect(diasDesde('2026-10-17T02:00:00Z', '2026-10-17')).toBe(1) // 23:00 of the 16th in Brazil
    expect(diasDesde('2026-10-17T12:00:00Z', '2026-10-17')).toBe(0)
    expect(diasDesde('2026-09-17T12:00:00Z', '2026-10-17')).toBe(30)
  })
})

describe('textoHaDias', () => {
  test('hoje, 1 dia, N dias', () => {
    expect(textoHaDias(0)).toBe('hoje')
    expect(textoHaDias(1)).toBe('há 1 dia')
    expect(textoHaDias(12)).toBe('há 12 dias')
  })
})

describe('separarAtividades', () => {
  const a = (id: string, quando: string) => ({ id, quando })
  test('late = before today, today = today; future left out; oldest first', () => {
    const r = separarAtividades(
      [a('amanha', '2026-10-18T12:00:00Z'), a('hoje-tarde', '2026-10-17T20:00:00Z'), a('ontem', '2026-10-16T12:00:00Z'),
        a('semana', '2026-10-10T12:00:00Z'), a('hoje-cedo', '2026-10-17T11:00:00Z'), a('virada', '2026-10-17T02:30:00Z')],
      '2026-10-17',
    )
    expect(r.atrasadas.map((x) => x.id)).toEqual(['semana', 'ontem', 'virada'])
    expect(r.deHoje.map((x) => x.id)).toEqual(['hoje-cedo', 'hoje-tarde'])
  })
  test('empty list', () => {
    expect(separarAtividades([], '2026-10-17')).toEqual({ atrasadas: [], deHoje: [] })
  })
})

describe('estaParada', () => {
  const hoje = '2026-10-17'
  test('open stage for more than the limit', () => {
    expect(estaParada('orcamento', '2026-10-09T12:00:00Z', 7, hoje)).toBe(true) // 8 days
    expect(estaParada('orcamento', '2026-10-10T12:00:00Z', 7, hoje)).toBe(false) // exactly 7
    expect(estaParada('interessado', '2026-01-01T12:00:00Z', 7, hoje)).toBe(true)
    expect(estaParada('reservado', '2026-01-01T12:00:00Z', 7, hoje)).toBe(true)
  })
  test('won or lost deals are never stalled', () => {
    for (const etapa of ['pago', 'viajou', 'pos_venda', 'perdido'] as const) {
      expect(estaParada(etapa, '2026-01-01T12:00:00Z', 7, hoje)).toBe(false)
    }
  })
})

describe('limiteSemContato', () => {
  test('anything before this instant is X or more Brazilian days ago', () => {
    const limite = limiteSemContato('2026-10-17', 30)
    expect(limite).toBe('2026-09-18T00:00:00-03:00')
    expect(diasDesde('2026-09-18T02:59:00Z', '2026-10-17')).toBe(30) // just before the limit
    expect(new Date('2026-09-18T02:59:00Z') < new Date(limite)).toBe(true)
    expect(diasDesde('2026-09-18T03:00:00Z', '2026-10-17')).toBe(29) // at the limit: not yet
  })
  test('crosses month and year boundaries', () => {
    expect(limiteSemContato('2026-01-05', 10)).toBe('2025-12-27T00:00:00-03:00')
    expect(limiteSemContato('2026-03-01', 1)).toBe('2026-03-01T00:00:00-03:00')
  })
})

describe('limitesSchema', () => {
  test('accepts whole days from 1 to 365', () => {
    expect(limitesSchema.parse({ diasSemContato: '45', diasParada: ' 14 ' })).toEqual({ diasSemContato: 45, diasParada: 14 })
  })
  test.each(['0', '366', '7.5', 'abc', '', '-3'])('refuses %j', (v) => {
    const r = limitesSchema.safeParse({ diasSemContato: v, diasParada: v })
    expect(r.success).toBe(false)
    if (!r.success) {
      const campos = r.error.flatten().fieldErrors
      expect(campos.diasSemContato?.[0]).toBe('Use um número inteiro de dias, de 1 a 365.')
      expect(campos.diasParada?.[0]).toBe('Use um número inteiro de dias, de 1 a 365.')
    }
  })
})
