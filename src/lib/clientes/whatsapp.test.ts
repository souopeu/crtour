import { describe, expect, test } from 'vitest'
import { mascararWhatsapp, normalizarWhatsapp } from './whatsapp'

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

describe('mascararWhatsapp (R124)', () => {
  test('letters never get in', () => {
    expect(mascararWhatsapp('asdasd')).toBe('')
    expect(mascararWhatsapp('11a9')).toBe('(11) 9')
  })
  test('formats a Brazilian number as it is typed', () => {
    expect(mascararWhatsapp('1')).toBe('(1')
    expect(mascararWhatsapp('11')).toBe('(11')
    expect(mascararWhatsapp('119888')).toBe('(11) 9888')
    expect(mascararWhatsapp('1198887777')).toBe('(11) 9888-7777')
    expect(mascararWhatsapp('11988887777')).toBe('(11) 98888-7777')
    expect(mascararWhatsapp('011988887777')).toBe('(11) 98888-7777')
  })
  test('pasting with symbols or "+55" gives the same stored number', () => {
    for (const colado of ['11 98888-7777', '+55 (11) 98888-7777', '(11) 98888-7777']) {
      expect(normalizarWhatsapp(mascararWhatsapp(colado))).toEqual({ ok: true, valor: '5511988887777' })
    }
  })
  test('international keeps "+" and at most 15 digits', () => {
    expect(mascararWhatsapp('+')).toBe('+')
    expect(mascararWhatsapp('+351 912 345 678')).toBe('+351912345678')
    expect(mascararWhatsapp('+1234567890123456789')).toBe('+123456789012345')
    expect(mascararWhatsapp('5511988887777')).toBe('+5511988887777')
  })
})
