import { describe, expect, test } from 'vitest'
import { hrefAtendimento, iniciais, lerFiltrosAtendimento, linhaDoTempo, marcaDeEnvio, tempoRelativo, textoDoEvento } from './atendimento'

const AGORA = new Date('2026-10-18T15:00:00-03:00') // Sunday

describe('lerFiltrosAtendimento', () => {
  test('defaults to Novos; keeps a valid search, tag and conversation', () => {
    expect(lerFiltrosAtendimento({}, true)).toEqual({ aba: 'novos', q: '', etiqueta: null, conversa: null })
    const id = '11111111-1111-4111-8111-111111111111'
    expect(lerFiltrosAtendimento({ aba: 'meus', q: '  ana ', etiqueta: id, c: id }, false)).toEqual({ aba: 'meus', q: 'ana', etiqueta: id, conversa: id })
  })
  test('a seller cannot open Outros, and junk is ignored', () => {
    expect(lerFiltrosAtendimento({ aba: 'outros' }, false).aba).toBe('novos')
    expect(lerFiltrosAtendimento({ aba: 'outros' }, true).aba).toBe('outros')
    expect(lerFiltrosAtendimento({ aba: 'x', etiqueta: 'nao-e-uuid', c: ['a', 'b'] }, true)).toEqual({ aba: 'novos', q: '', etiqueta: null, conversa: null })
  })
  test('a very long search is cut', () => {
    expect(lerFiltrosAtendimento({ q: 'a'.repeat(500) }, true).q).toHaveLength(100)
  })
})

describe('tempoRelativo', () => {
  test.each([
    ['2026-10-18T14:59:30-03:00', 'há poucos segundos'],
    ['2026-10-18T14:59:00-03:00', 'há 1 minuto'],
    ['2026-10-18T14:45:00-03:00', 'há 15 minutos'],
    ['2026-10-18T12:00:00-03:00', 'há 3 horas'],
    ['2026-10-17T23:00:00-03:00', 'ontem'],
    ['2026-10-13T10:00:00-03:00', 'terça'],
    ['2026-10-02T10:00:00-03:00', '02/10'],
    ['2025-12-20T10:00:00-03:00', '20/12/2025'],
  ])('%s → %s', (iso, esperado) => expect(tempoRelativo(iso, AGORA)).toBe(esperado))
})

test('iniciais', () => {
  expect(iniciais('Ana Souza Lima')).toBe('AL')
  expect(iniciais('  bia ')).toBe('B')
  expect(iniciais('')).toBe('?')
})

test('marcaDeEnvio', () => {
  expect(marcaDeEnvio('recebida', 'recebida')).toBeNull()
  expect(marcaDeEnvio('enviada', 'enviada')).toEqual({ simbolo: '✓', texto: 'enviada' })
  expect(marcaDeEnvio('enviada', 'entregue')).toEqual({ simbolo: '✓✓', texto: 'entregue' })
  expect(marcaDeEnvio('enviada', 'lida')).toEqual({ simbolo: '✓✓', texto: 'lida' })
  expect(marcaDeEnvio('enviada', 'falhou')).toEqual({ simbolo: '!', texto: 'não enviada' })
})

describe('textoDoEvento', () => {
  const nomes = new Map([['u1', 'Ana'], ['u2', 'Leila']])
  test.each([
    [{ tipo: 'assumiu', autor_id: 'u1' }, 'Ana assumiu o atendimento'],
    [{ tipo: 'transferiu', autor_id: 'u1', para_id: 'u2' }, 'Ana passou o atendimento para Leila'],
    [{ tipo: 'arquivou', autor_id: 'u9' }, 'Pessoa removida arquivou o atendimento'],
    [{ tipo: 'reabriu' }, 'Reaberto: nova mensagem do cliente'],
    [{ tipo: 'etiqueta_adicionada', autor_id: 'u1', detalhe: 'Europa' }, 'Etiqueta Europa adicionada'],
    [{ tipo: 'etiqueta_removida', detalhe: 'Europa' }, 'Etiqueta Europa removida'],
    [{ tipo: 'chegou_por_anuncio', detalhe: 'Lisboa em maio' }, 'Chegou pelo anúncio "Lisboa em maio"'],
  ] as const)('%o', (evento, esperado) => expect(textoDoEvento({ autor_id: null, para_id: null, detalhe: null, ...evento }, nomes)).toBe(esperado))
})

describe('linhaDoTempo', () => {
  const itens = linhaDoTempo(
    [
      { id: 'm2', em: '2026-10-18T10:00:00-03:00', tipo: 'mensagem' as const },
      { id: 'm1', em: '2026-10-17T09:00:00-03:00', tipo: 'mensagem' as const },
    ],
    [{ id: 'e1', em: '2026-10-18T09:00:00-03:00', tipo: 'evento' as const }],
    AGORA,
  )
  test('everything in time order, grouped by day with a readable label', () => {
    expect(itens.map((d) => d.rotulo)).toEqual(['Ontem', 'Hoje'])
    expect(itens[1].itens.map((i) => i.id)).toEqual(['e1', 'm2'])
  })
  test('older days show the date', () => {
    const d = linhaDoTempo([{ id: 'x', em: '2026-10-01T10:00:00-03:00', tipo: 'mensagem' as const }], [], AGORA)
    expect(d[0].rotulo).toBe('01/10/2026')
  })
})

describe('hrefAtendimento', () => {
  const base = { aba: 'novos' as const, q: '', etiqueta: null, conversa: null }
  test('the default tab has a clean link', () => expect(hrefAtendimento(base, {})).toBe('/atendimento'))
  test('keeps search and tag, adds the conversation', () => {
    expect(hrefAtendimento({ ...base, aba: 'meus', q: 'ana silva' }, { conversa: 'c1' })).toBe('/atendimento?aba=meus&q=ana+silva&c=c1')
  })
})
