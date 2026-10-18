import { describe, expect, test } from 'vitest'
import { proximoSeguro } from './redirect'

describe('proximoSeguro', () => {
  test('keeps same-site relative paths', () => {
    expect(proximoSeguro('/clientes/123?aba=notas')).toBe('/clientes/123?aba=notas')
  })

  test.each([
    ['absolute url', 'https://evil.com'],
    ['protocol-relative url', '//evil.com'],
    ['backslash trick', '/\\evil.com'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['no leading slash', 'clientes'],
    ['empty', ''],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to / for %s', (_nome, valor) => {
    expect(proximoSeguro(valor)).toBe('/')
  })
})
