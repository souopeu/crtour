import { describe, expect, test } from 'vitest'
import { PENDENTES, temPendencias } from './dados'

describe('temPendencias', () => {
  test('is true while any placeholder is still unfilled', () => {
    expect(temPendencias({ a: 'Fulano Ltda', b: '[PREENCHER: e-mail]' })).toBe(true)
    expect(temPendencias({ a: '[CONFIRMAR: região]' })).toBe(true)
  })
  test('is false once everything is filled', () => {
    expect(temPendencias({ a: 'Fulano Ltda', b: 'privacidade@crtour.com.br' })).toBe(false)
  })
  test('the shipped draft still has pending items (blocks silent publication)', () => {
    expect(temPendencias(PENDENTES)).toBe(true)
  })
})
