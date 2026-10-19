import { createHmac } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { assinaturaValida, desafioDeVerificacao, lerAvisoMeta, provedorMeta } from './meta'

// Payloads shaped like the examples in Meta's Cloud API and coexistence docs (19/10/2026).
const meta = { display_phone_number: '5511900000000', phone_number_id: 'PN-1' }
const aviso = (field: string, value: object) => ({ object: 'whatsapp_business_account', entry: [{ id: 'WABA-1', changes: [{ field, value: { messaging_product: 'whatsapp', metadata: meta, ...value } }] }] })

const recebida = aviso('messages', {
  contacts: [{ profile: { name: 'Ana Souza' }, wa_id: '5511999990001' }],
  messages: [
    { from: '5511999990001', id: 'wamid.A', timestamp: '1760875200', type: 'text', text: { body: 'Oi, vi o anúncio' },
      referral: { source_url: 'https://fb.me/x', source_id: '120200', source_type: 'ad', headline: 'Gramado no inverno', ctwa_clid: 'CLID-1' } },
    { from: '5511999990001', id: 'wamid.B', timestamp: '1760875260', type: 'image', image: { id: 'MEDIA-1' } },
  ],
})

describe('lerAvisoMeta', () => {
  test('received messages, with name, time and ad data; media becomes a short label', () => {
    expect(lerAvisoMeta(recebida)).toEqual([
      { tipo: 'mensagem', conta: 'PN-1', idExterno: 'wamid.A', de: '5511999990001', nome: 'Ana Souza', texto: 'Oi, vi o anúncio', em: '2025-10-19T12:00:00.000Z',
        referencia: { anuncioId: '120200', titulo: 'Gramado no inverno', url: 'https://fb.me/x', cliqueId: 'CLID-1' } },
      { tipo: 'mensagem', conta: 'PN-1', idExterno: 'wamid.B', de: '5511999990001', nome: 'Ana Souza', texto: '[foto]', em: '2025-10-19T12:01:00.000Z', referencia: null },
    ])
  })
  test('delivery statuses', () => {
    const a = aviso('messages', { statuses: [{ id: 'wamid.C', status: 'read', timestamp: '1760875300', recipient_id: '5511999990001' }] })
    expect(lerAvisoMeta(a)).toEqual([{ tipo: 'status', idExterno: 'wamid.C', situacao: 'lida' }])
  })
  test('echoes of what the agency sent from the phone', () => {
    const a = aviso('smb_message_echoes', { message_echoes: [{ from: '5511900000000', to: '5511999990001', id: 'wamid.E', timestamp: '1760875400', type: 'text', text: { body: 'Tem sim!' } }] })
    expect(lerAvisoMeta(a)).toEqual([{ tipo: 'eco', conta: 'PN-1', idExterno: 'wamid.E', para: '5511999990001', texto: 'Tem sim!', em: '2025-10-19T12:03:20.000Z' }])
  })
  test('history: one conversation per thread, direction from who wrote', () => {
    const a = aviso('history', { history: [{ metadata: { phase: 0, chunk_order: 1, progress: 100 }, threads: [{ id: '5511999990002', messages: [
      { from: '5511999990002', id: 'wamid.H1', timestamp: '1757000000', type: 'text', text: { body: 'Quero ir para Lisboa' }, history_context: { status: 'READ' } },
      { from: '5511900000000', id: 'wamid.H2', timestamp: '1757000600', type: 'text', text: { body: 'Temos saída em maio' }, history_context: { status: 'DELIVERED' } },
    ] }] }] })
    expect(lerAvisoMeta(a)).toEqual([{ tipo: 'historico', conta: 'PN-1', conversas: [{ numero: '5511999990002', mensagens: [
      { id: 'wamid.H1', doCliente: true, texto: 'Quero ir para Lisboa', em: '2025-09-04T15:33:20.000Z' },
      { id: 'wamid.H2', doCliente: false, texto: 'Temos saída em maio', em: '2025-09-04T15:43:20.000Z' },
    ] }] }])
  })
  test('history turned off by the business, groups, other fields and junk are ignored', () => {
    expect(lerAvisoMeta(aviso('history', { history: [{ errors: [{ code: 2593109, title: 'History sync is turned off' }] }] }))).toEqual([])
    expect(lerAvisoMeta(aviso('account_update', { event: 'X' }))).toEqual([])
    expect(lerAvisoMeta({ qualquer: 'coisa' })).toEqual([])
  })
})

describe('assinaturaValida', () => {
  const corpo = JSON.stringify(recebida)
  const assinar = (s: string) => `sha256=${createHmac('sha256', s).update(corpo).digest('hex')}`
  test('only the app secret signs a notice', () => {
    expect(assinaturaValida(corpo, assinar('segredo'), 'segredo')).toBe(true)
    expect(assinaturaValida(corpo, assinar('outro'), 'segredo')).toBe(false)
    expect(assinaturaValida(corpo, null, 'segredo')).toBe(false)
    expect(assinaturaValida(corpo, 'sha256=curto', 'segredo')).toBe(false)
    expect(assinaturaValida(corpo, assinar(''), '')).toBe(false) // no secret configured: nothing is accepted
  })
})

describe('provedorMeta', () => {
  test('reads signed notices and never sends in this phase (read only)', async () => {
    const p = provedorMeta({ WHATSAPP_META_APP_SECRET: 'segredo' })
    const corpo = JSON.stringify(recebida)
    const cab = new Headers({ 'x-hub-signature-256': `sha256=${createHmac('sha256', 'segredo').update(corpo).digest('hex')}` })
    expect(await p.validarAviso(corpo, cab)).toHaveLength(2)
    expect(await p.validarAviso(corpo, new Headers())).toBeNull()
    await expect(p.enviarTexto({ para: '5511999990001', texto: 'Oi' })).rejects.toThrow()
  })
})

describe('desafioDeVerificacao', () => {
  const p = (q: string) => new URLSearchParams(q)
  test('echoes the challenge only for our verify token', () => {
    expect(desafioDeVerificacao(p('hub.mode=subscribe&hub.verify_token=t1&hub.challenge=1158201444'), 't1')).toBe('1158201444')
    expect(desafioDeVerificacao(p('hub.mode=subscribe&hub.verify_token=errado&hub.challenge=1'), 't1')).toBeNull()
    expect(desafioDeVerificacao(p('hub.mode=subscribe&hub.verify_token=&hub.challenge=1'), undefined)).toBeNull()
    expect(desafioDeVerificacao(p('hub.mode=subscribe&hub.verify_token=t1&hub.challenge=<script>'), 't1')).toBeNull()
  })
})
