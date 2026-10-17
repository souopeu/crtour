import { describe, expect, test } from 'vitest'
import { formatarDataHora } from './formato'

describe('formatarDataHora', () => {
  test('formats in Brazil time (UTC-3)', () => {
    expect(formatarDataHora('2026-10-17T15:30:00Z')).toBe('17/10/2026 12:30')
  })
  test('returns an empty string for invalid input', () => {
    expect(formatarDataHora('lixo')).toBe('')
  })
})
