import { describe, expect, test } from 'vitest'
import { relogioAutorizado } from './relogio'

const SEGREDO = 'segredo-de-teste-com-32-caracteres'

describe('relogioAutorizado (R132)', () => {
  test('only the exact bearer secret passes', () => {
    expect(relogioAutorizado(`Bearer ${SEGREDO}`, SEGREDO)).toBe(true)
    expect(relogioAutorizado(`Bearer ${SEGREDO}x`, SEGREDO)).toBe(false)
    expect(relogioAutorizado(SEGREDO, SEGREDO)).toBe(false)
    expect(relogioAutorizado(null, SEGREDO)).toBe(false)
  })
  test('closed when the secret is missing or too short', () => {
    expect(relogioAutorizado('Bearer ', undefined)).toBe(false)
    expect(relogioAutorizado('Bearer curto', 'curto')).toBe(false)
  })
})
