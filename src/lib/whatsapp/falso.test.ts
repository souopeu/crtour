import { describe, expect, test } from 'vitest'
import { provedorDeEnvio } from './falso'

const LOCAL = { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', WHATSAPP_FALSO_LOCAL: '1' }

describe('provedorDeEnvio', () => {
  test('nothing configured: no sending', () => {
    expect(provedorDeEnvio({})).toBeNull()
  })
  test('the fake provider only exists on a local database and with the test flag', () => {
    expect(provedorDeEnvio({ ...LOCAL, WHATSAPP_FALSO_LOCAL: undefined })).toBeNull()
    expect(provedorDeEnvio({ ...LOCAL, NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' })).toBeNull()
    expect(provedorDeEnvio(LOCAL)?.nome).toBe('falso')
  })
  test('it accepts a message with a fresh id and fails on demand, never trusting a notice', async () => {
    const p = provedorDeEnvio(LOCAL)!
    const a = await p.enviarTexto({ para: '5511999990001', texto: 'Oi' })
    const b = await p.enviarTexto({ para: '5511999990001', texto: 'Oi' })
    expect(a.idExterno).not.toBe(b.idExterno)
    await expect(p.enviarTexto({ para: '5511999990001', texto: 'teste [falha]' })).rejects.toThrow()
    expect(await p.validarAviso('[]', new Headers())).toBeNull()
  })
})
