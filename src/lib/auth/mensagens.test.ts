import { describe, expect, test } from 'vitest'
import { traduzirErroAuth } from './mensagens'

describe('traduzirErroAuth', () => {
  test('translates known codes', () => {
    expect(traduzirErroAuth({ code: 'invalid_credentials' })).toMatch(/e-mail ou senha/i)
    expect(traduzirErroAuth({ code: 'user_already_exists' })).toMatch(/já existe/i)
    expect(traduzirErroAuth({ code: 'over_request_rate_limit' })).toMatch(/muitas tentativas/i)
  })

  test('never leaks unknown technical messages', () => {
    const msg = traduzirErroAuth({ code: 'weird', message: 'duplicate key value violates constraint xyz' })
    expect(msg).not.toMatch(/duplicate|constraint|xyz/)
    expect(msg).toMatch(/tente novamente/i)
  })
})
