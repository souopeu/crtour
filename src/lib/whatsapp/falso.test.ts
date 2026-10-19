import { describe, expect, test } from 'vitest'
import { provedorDeEnvio } from './falso'

const LOCAL = { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', WHATSAPP_FALSO_LOCAL: '1' }

describe('provedorDeEnvio', () => {
  test('nothing configured: no sending', () => {
    expect(provedorDeEnvio({}, 'falso')).toBeNull()
    expect(provedorDeEnvio({}, 'meta')).toBeNull()
  })
  test('a channel only sends through its own provider', () => {
    expect(provedorDeEnvio({ ...LOCAL, WHATSAPP_PROVEDOR: 'meta' }, 'meta')?.nome).toBe('meta')
    expect(provedorDeEnvio({ ...LOCAL, WHATSAPP_PROVEDOR: 'meta' }, 'outro')).toBeNull()
  })
  test('the fake provider only exists on a local database and with the test flag', () => {
    expect(provedorDeEnvio({ ...LOCAL, WHATSAPP_FALSO_LOCAL: undefined }, 'falso')).toBeNull()
    expect(provedorDeEnvio({ ...LOCAL, NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' }, 'falso')).toBeNull()
    expect(provedorDeEnvio(LOCAL, 'falso')?.nome).toBe('falso')
  })
  test('it accepts a message with a fresh id and fails on demand, never trusting a notice', async () => {
    const p = provedorDeEnvio(LOCAL, 'falso')!
    const a = await p.enviarTexto({ para: '5511999990001', texto: 'Oi' })
    const b = await p.enviarTexto({ para: '5511999990001', texto: 'Oi' })
    expect(a.idExterno).not.toBe(b.idExterno)
    await expect(p.enviarTexto({ para: '5511999990001', texto: 'teste [falha]' })).rejects.toThrow()
    expect(await p.validarAviso('[]', new Headers())).toBeNull()
  })
})
