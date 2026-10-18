import { describe, expect, test, vi } from 'vitest'
import { obterProvedor, tratarAviso, type ProvedorPagamento } from './pagamentoOnline'

// Fake provider: the notice body is JSON and the "signature" header must be "ok".
const falso: ProvedorPagamento = {
  nome: 'falso',
  async criarCobranca({ reservaId, valorCentavos }) {
    return { idExterno: `fx-${reservaId}`, link: `https://pague.exemplo/${reservaId}?v=${valorCentavos}` }
  },
  async validarAviso(corpo, cabecalhos) {
    if (cabecalhos.get('x-assinatura') !== 'ok') return null
    const d = JSON.parse(corpo) as { id: string; valor: number; forma: 'pix' | 'cartao'; pagoEm: string }
    return { idExterno: d.id, valorCentavos: d.valor, forma: d.forma, pagoEm: d.pagoEm }
  },
}
const registro = { falso: () => falso }
const aviso = JSON.stringify({ id: 'fx-1', valor: 5000, forma: 'pix', pagoEm: '2026-10-15T16:00:00Z' })
const assinado = new Headers({ 'x-assinatura': 'ok' })

describe('obterProvedor', () => {
  test('no provider configured: the feature does not exist (null), nothing breaks', () => {
    expect(obterProvedor({}, registro)).toBeNull()
    expect(obterProvedor({ PAGAMENTO_ONLINE_PROVEDOR: '' }, registro)).toBeNull()
  })
  test('unknown name is treated as not configured', () => {
    expect(obterProvedor({ PAGAMENTO_ONLINE_PROVEDOR: 'nao-existe' }, registro)).toBeNull()
  })
  test('known provider', async () => {
    const p = obterProvedor({ PAGAMENTO_ONLINE_PROVEDOR: 'falso' }, registro)
    expect(p?.nome).toBe('falso')
    expect(await p!.criarCobranca({ reservaId: 'r1', valorCentavos: 100, descricao: 'x', venceEm: null })).toEqual({ idExterno: 'fx-r1', link: 'https://pague.exemplo/r1?v=100' })
  })
  test('the real registry has no provider yet', () => {
    expect(obterProvedor({ PAGAMENTO_ONLINE_PROVEDOR: 'falso' })).toBeNull()
  })
})

describe('tratarAviso', () => {
  test('no provider, or another provider name in the URL: 404', async () => {
    const confirmar = vi.fn()
    expect(await tratarAviso({ provedor: null, nomeNaUrl: 'falso', corpo: aviso, cabecalhos: assinado, confirmar })).toEqual({ status: 404 })
    expect(await tratarAviso({ provedor: falso, nomeNaUrl: 'outro', corpo: aviso, cabecalhos: assinado, confirmar })).toEqual({ status: 404 })
    expect(confirmar).not.toHaveBeenCalled()
  })
  test('invalid signature: 401 and nothing confirmed', async () => {
    const confirmar = vi.fn()
    expect(await tratarAviso({ provedor: falso, nomeNaUrl: 'falso', corpo: aviso, cabecalhos: new Headers(), confirmar })).toEqual({ status: 401 })
    expect(confirmar).not.toHaveBeenCalled()
  })
  test('valid notice confirms the charge with what the provider says', async () => {
    const confirmar = vi.fn().mockResolvedValue({ ok: true })
    expect(await tratarAviso({ provedor: falso, nomeNaUrl: 'falso', corpo: aviso, cabecalhos: assinado, confirmar })).toEqual({ status: 200 })
    expect(confirmar).toHaveBeenCalledWith({ provedor: 'falso', idExterno: 'fx-1', valorCentavos: 5000, forma: 'pix', pagoEm: '2026-10-15T16:00:00Z' })
  })
  test('business refusals answer 200 (no endless retries) but are flagged; unexpected errors answer 500 (provider retries)', async () => {
    const recusa = vi.fn().mockResolvedValue({ ok: false, codigo: 'CR007' })
    expect(await tratarAviso({ provedor: falso, nomeNaUrl: 'falso', corpo: aviso, cabecalhos: assinado, confirmar: recusa })).toEqual({ status: 200, conferir: 'CR007' })
    const falha = vi.fn().mockResolvedValue({ ok: false, codigo: '08006' })
    expect(await tratarAviso({ provedor: falso, nomeNaUrl: 'falso', corpo: aviso, cabecalhos: assinado, confirmar: falha })).toEqual({ status: 500 })
  })
  test('a malformed body never confirms', async () => {
    const confirmar = vi.fn()
    expect(await tratarAviso({ provedor: falso, nomeNaUrl: 'falso', corpo: '{', cabecalhos: assinado, confirmar })).toEqual({ status: 400 })
    expect(confirmar).not.toHaveBeenCalled()
  })
})
