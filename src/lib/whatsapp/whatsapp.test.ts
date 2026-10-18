import { describe, expect, test, vi } from 'vitest'
import { dentroDaJanela, obterProvedorWhatsapp, tratarAvisoWhatsapp, type ProvedorWhatsapp } from './whatsapp'

// Fake provider: JSON body, "x-assinatura: ok" header.
const falso: ProvedorWhatsapp = {
  nome: 'falso',
  async enviarTexto({ para, texto }) { return { idExterno: `t-${para}-${texto.length}` } },
  async enviarModelo({ para, modelo }) { return { idExterno: `m-${para}-${modelo}` } },
  async validarAviso(corpo, cabecalhos) {
    if (cabecalhos.get('x-assinatura') !== 'ok') return null
    return JSON.parse(corpo)
  },
}
const registro = { falso: () => falso }
const assinado = new Headers({ 'x-assinatura': 'ok' })
const mensagem = { tipo: 'mensagem', conta: 'num-1', idExterno: 'w1', de: '5511999990001', nome: 'Ana', texto: 'Oi', em: '2026-10-18T13:00:00Z' }
const status = { tipo: 'status', idExterno: 'e1', situacao: 'lida' }

describe('obterProvedorWhatsapp', () => {
  test('no provider configured: the feature does not exist', () => {
    expect(obterProvedorWhatsapp({}, registro)).toBeNull()
    expect(obterProvedorWhatsapp({ WHATSAPP_PROVEDOR: 'nao-existe' }, registro)).toBeNull()
    expect(obterProvedorWhatsapp({ WHATSAPP_PROVEDOR: 'falso' })).toBeNull() // the real registry is empty
  })
  test('known provider sends text and templates', async () => {
    const p = obterProvedorWhatsapp({ WHATSAPP_PROVEDOR: 'falso' }, registro)!
    expect(await p.enviarTexto({ para: '5511999990001', texto: 'Oi' })).toEqual({ idExterno: 't-5511999990001-2' })
    expect(await p.enviarModelo({ para: '5511999990001', modelo: 'lembrete', variaveis: ['Ana'] })).toEqual({ idExterno: 'm-5511999990001-lembrete' })
  })
})

describe('tratarAvisoWhatsapp', () => {
  const corpo = JSON.stringify([mensagem, status])
  test('no provider or another name: 404, nothing stored', async () => {
    const gravar = vi.fn()
    expect(await tratarAvisoWhatsapp({ provedor: null, nomeNaUrl: 'falso', corpo, cabecalhos: assinado, gravar })).toEqual({ status: 404 })
    expect(await tratarAvisoWhatsapp({ provedor: falso, nomeNaUrl: 'outro', corpo, cabecalhos: assinado, gravar })).toEqual({ status: 404 })
    expect(gravar).not.toHaveBeenCalled()
  })
  test('bad signature: 401; malformed body: 400', async () => {
    const gravar = vi.fn()
    expect(await tratarAvisoWhatsapp({ provedor: falso, nomeNaUrl: 'falso', corpo, cabecalhos: new Headers(), gravar })).toEqual({ status: 401 })
    expect(await tratarAvisoWhatsapp({ provedor: falso, nomeNaUrl: 'falso', corpo: '{', cabecalhos: assinado, gravar })).toEqual({ status: 400 })
    expect(gravar).not.toHaveBeenCalled()
  })
  test('stores every validated event, in order', async () => {
    const gravar = vi.fn().mockResolvedValue({ ok: true })
    expect(await tratarAvisoWhatsapp({ provedor: falso, nomeNaUrl: 'falso', corpo, cabecalhos: assinado, gravar })).toEqual({ status: 200 })
    expect(gravar.mock.calls.map((c) => c[0].tipo)).toEqual(['mensagem', 'status'])
    expect(gravar).toHaveBeenCalledWith({ ...mensagem, provedor: 'falso' })
  })
  test('events the provider sends but nobody should act on are refused before storing', async () => {
    const gravar = vi.fn().mockResolvedValue({ ok: true })
    const ruim = JSON.stringify([{ ...mensagem, de: 'abc' }, { ...status, situacao: 'qualquer' }])
    expect(await tratarAvisoWhatsapp({ provedor: falso, nomeNaUrl: 'falso', corpo: ruim, cabecalhos: assinado, gravar })).toEqual({ status: 400 })
    expect(gravar).not.toHaveBeenCalled()
  })
  test('a number of no agency answers 200 (no retries) but is flagged; unexpected errors answer 500', async () => {
    const recusa = vi.fn().mockResolvedValue({ ok: false, codigo: 'P0002' })
    expect(await tratarAvisoWhatsapp({ provedor: falso, nomeNaUrl: 'falso', corpo, cabecalhos: assinado, gravar: recusa })).toEqual({ status: 200, conferir: 'P0002' })
    const falha = vi.fn().mockResolvedValue({ ok: false, codigo: '08006' })
    expect(await tratarAvisoWhatsapp({ provedor: falso, nomeNaUrl: 'falso', corpo, cabecalhos: assinado, gravar: falha })).toEqual({ status: 500 })
  })
})

describe('dentroDaJanela', () => {
  const agora = new Date('2026-10-18T12:00:00Z')
  test('free text only within 24 hours of the client\'s last message', () => {
    expect(dentroDaJanela('2026-10-17T12:00:01Z', agora)).toBe(true)
    expect(dentroDaJanela('2026-10-17T11:59:59Z', agora)).toBe(false)
    expect(dentroDaJanela(null, agora)).toBe(false)
  })
})
