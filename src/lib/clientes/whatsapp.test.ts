import { describe, expect, test } from 'vitest'
import { normalizarWhatsapp } from './whatsapp'

describe('normalizarWhatsapp', () => {
  test.each([
    ['(11) 99999-9999', '5511999999999'],
    ['11 3333-4444', '551133334444'],
    ['+55 11 99999-9999', '5511999999999'],
    ['55 11 99999-9999', '5511999999999'],
    ['011 99999-9999', '5511999999999'],
    ['+351 912 345 678', '351912345678'],
  ])('normalizes %s', (entrada, esperado) => {
    expect(normalizarWhatsapp(entrada)).toEqual({ ok: true, valor: esperado })
  })

  test.each(['', '   ', null, undefined])('treats %j as empty', (entrada) => {
    expect(normalizarWhatsapp(entrada)).toEqual({ ok: true, valor: null })
  })

  test.each(['123', 'abc', '99999', '+1', '1234567890123456789'])('rejects %s', (entrada) => {
    expect(normalizarWhatsapp(entrada).ok).toBe(false)
  })
})
