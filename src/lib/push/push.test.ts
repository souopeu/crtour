import { describe, expect, test } from 'vitest'
import { configVapid, conteudoDoPush, enviarPushes, type LinhaPush } from './push'

const linha = (p: Partial<LinhaPush> = {}): LinhaPush => ({
  aviso_id: 'a1', tipo: 'atividade_agora', titulo: 'Ligar', cliente_nome: 'Ana', valor_centavos: 0, negociacao_id: null,
  reserva_id: null, saida_id: null, cliente_id: 'c1', inscricao_id: 'i1', endpoint: 'https://push.example/1', p256dh: 'k', auth: 's', ...p,
})

describe('push (R131)', () => {
  test('the message reads like the bell and opens the right screen', () => {
    expect(conteudoDoPush(linha())).toEqual({ title: 'Agora: Ligar', body: 'Ana', url: '/clientes/c1', tag: 'a1' })
    expect(conteudoDoPush(linha({ tipo: 'saida_chegando', titulo: 'Serra', saida_id: 's1', cliente_id: null })).url).toBe('/saidas/s1')
    expect(conteudoDoPush(linha({ cliente_id: null })).url).toBe('/avisos')
  })

  test('sends each row, returns gone devices (404/410) and counts other failures', async () => {
    const enviados: string[] = []
    const r = await enviarPushes(
      [linha(), linha({ inscricao_id: 'i2', endpoint: 'https://push.example/sumiu' }), linha({ inscricao_id: 'i3', endpoint: 'https://push.example/erro' })],
      async (i, corpo) => {
        if (i.endpoint.endsWith('sumiu')) throw Object.assign(new Error('gone'), { statusCode: 410 })
        if (i.endpoint.endsWith('erro')) throw Object.assign(new Error('boom'), { statusCode: 500 })
        enviados.push(JSON.parse(corpo).title)
      },
    )
    expect(r).toEqual({ enviados: 1, falhas: 1, sumidas: ['i2'] })
    expect(enviados).toEqual(['Agora: Ligar'])
  })

  test('VAPID needs both keys and a mailto contact', () => {
    expect(configVapid({})).toBeNull()
    expect(configVapid({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'p', VAPID_PRIVATE_KEY: 'q', VAPID_SUBJECT: 'https://x' })).toBeNull()
    expect(configVapid({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'p', VAPID_PRIVATE_KEY: 'q', VAPID_SUBJECT: 'mailto:a@b.c' })).toEqual({ publica: 'p', privada: 'q', contato: 'mailto:a@b.c' })
  })
})
