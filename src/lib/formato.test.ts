import { describe, expect, test } from 'vitest'
import { formatarDataBr, formatarDataHora, hojeNoBrasil } from './formato'

describe('formatarDataHora', () => {
  test('formats in Brazil time (UTC-3)', () => {
    expect(formatarDataHora('2026-10-17T15:30:00Z')).toBe('17/10/2026 12:30')
  })
  test('returns an empty string for invalid input', () => {
    expect(formatarDataHora('lixo')).toBe('')
  })
})

describe('formatarDataBr', () => {
  test('turns an ISO date into dd/mm/aaaa without timezone shifts', () => {
    expect(formatarDataBr('1990-05-17')).toBe('17/05/1990')
  })
  test('returns an empty string for empty or malformed input', () => {
    expect(formatarDataBr(null)).toBe('')
    expect(formatarDataBr('')).toBe('')
    expect(formatarDataBr('17/05/1990')).toBe('')
  })
})

describe('hojeNoBrasil', () => {
  test('uses the Brazilian calendar day, not UTC', () => {
    expect(hojeNoBrasil(new Date('2026-10-17T02:00:00Z'))).toBe('2026-10-16')
    expect(hojeNoBrasil(new Date('2026-10-17T12:00:00Z'))).toBe('2026-10-17')
  })
})
