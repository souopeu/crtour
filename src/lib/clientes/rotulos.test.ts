import { describe, expect, test } from 'vitest'
import { formatarWhatsapp } from './rotulos'

describe('formatarWhatsapp', () => {
  test.each([
    ['5511999999999', '(11) 99999-9999'],
    ['551133334444', '(11) 3333-4444'],
    ['351912345678', '+351912345678'],
    ['', ''],
    [null, ''],
  ])('formats %j', (entrada, esperado) => {
    expect(formatarWhatsapp(entrada)).toBe(esperado)
  })
})
