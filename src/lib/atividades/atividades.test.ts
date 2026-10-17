import { describe, expect, test } from 'vitest'
import {
  TIPOS, atividadeSchema, atrasadaAgora, dataHoraLocalParaIso, isoParaDataHoraLocal, montarLinhaDoTempo, rotuloDoTipo, textoUltimaInteracao,
} from './atividades'

describe('dataHoraLocalParaIso / isoParaDataHoraLocal (Brazil time, UTC-3)', () => {
  test('converts the value of a datetime-local input to an absolute instant', () => {
    expect(dataHoraLocalParaIso('2026-10-17T14:30')).toBe('2026-10-17T17:30:00.000Z')
    expect(dataHoraLocalParaIso('2026-10-17T22:30')).toBe('2026-10-18T01:30:00.000Z')
  })
  test('rejects what is not a real date and time', () => {
    for (const v of ['', 'amanhã', '2026-10-17', '2026-02-31T10:00', '2026-10-17T25:00', '17/10/2026 14:30']) {
      expect(dataHoraLocalParaIso(v), v).toBeNull()
    }
  })
  test('round trip back to the input format', () => {
    expect(isoParaDataHoraLocal('2026-10-17T17:30:00.000Z')).toBe('2026-10-17T14:30')
    expect(isoParaDataHoraLocal('2026-10-18T01:30:00Z')).toBe('2026-10-17T22:30')
    expect(isoParaDataHoraLocal('lixo')).toBe('')
  })
})

describe('tipos', () => {
  test('the five kinds with Portuguese labels', () => {
    expect(TIPOS.map((t) => t.valor)).toEqual(['ligacao', 'whatsapp', 'email', 'reuniao', 'tarefa'])
    expect(rotuloDoTipo('ligacao')).toBe('Ligação')
    expect(rotuloDoTipo('reuniao')).toBe('Reunião')
  })
})

describe('atividadeSchema', () => {
  const uuid = 'a4000000-0000-4000-8000-000000000001'
  const ok = { tipo: 'ligacao', titulo: ' Ligar para a Ana ', quando: '2026-10-17T14:30', status: 'pendente', responsavel: '', negociacao: '', motivo: '' }
  test('converts the date and nulls the optional ids', () => {
    expect(atividadeSchema.parse(ok)).toEqual({
      tipo: 'ligacao', titulo: 'Ligar para a Ana', quando: '2026-10-17T17:30:00.000Z', status: 'pendente', responsavel_id: null, negociacao_id: null, motivo: null,
    })
    expect(atividadeSchema.parse({ ...ok, status: 'feito', responsavel: uuid, negociacao: uuid })).toMatchObject({ status: 'feito', responsavel_id: uuid, negociacao_id: uuid })
  })
  test.each([
    ['blank title', { titulo: '  ' }],
    ['long title', { titulo: 'a'.repeat(201) }],
    ['unknown kind', { tipo: 'pombo' }],
    ['unknown status', { status: 'quase' }],
    ['missing date', { quando: '' }],
    ['bad date', { quando: '2026-02-31T10:00' }],
    ['bad responsible id', { responsavel: 'maria' }],
    ['bad deal id', { negociacao: '123' }],
  ])('rejects %s', (_n, parcial) => {
    expect(atividadeSchema.safeParse({ ...ok, ...parcial }).success).toBe(false)
  })
})

describe('montarLinhaDoTempo', () => {
  const anotacoes = [
    { id: 'n1', texto: 'Quer viajar em março', autor: 'Ana', criada_em: '2026-10-10T12:00:00Z' },
    { id: 'n2', texto: 'Pediu desconto', autor: 'Beto', criada_em: '2026-10-15T12:00:00Z' },
  ]
  const atividades = [
    { id: 'a1', tipo: 'ligacao' as const, titulo: 'Ligar', quando: '2026-10-12T12:00:00Z', status: 'feito' as const, feito_em: '2026-10-12T13:00:00Z', responsavel_nome: 'Zeca' },
    { id: 'a2', tipo: 'tarefa' as const, titulo: 'Enviar proposta', quando: '2026-10-20T12:00:00Z', status: 'pendente' as const, feito_em: null, responsavel_nome: null },
  ]
  test('merges notes and activities, newest first; a done activity counts from when it was done', () => {
    const t = montarLinhaDoTempo(anotacoes, atividades)
    expect(t.map((i) => `${i.tipo}:${i.id}`)).toEqual(['atividade:a2', 'anotacao:n2', 'atividade:a1', 'anotacao:n1'])
  })
  test('empty input', () => {
    expect(montarLinhaDoTempo([], [])).toEqual([])
  })
})

describe('textoUltimaInteracao', () => {
  const hoje = '2026-10-17'
  test.each([
    [null, 'Nenhuma interação registrada'],
    ['2026-10-17T15:00:00Z', 'Última interação: 17/10/2026 (hoje)'],
    ['2026-10-16T15:00:00Z', 'Última interação: 16/10/2026 (ontem)'],
    ['2026-10-10T15:00:00Z', 'Última interação: 10/10/2026 (há 7 dias)'],
  ])('%s', (iso, esperado) => {
    expect(textoUltimaInteracao(iso, hoje)).toBe(esperado)
  })
})

describe('atrasadaAgora', () => {
  test('only pending activities in the past are late', () => {
    const agora = '2026-10-17T15:00:00.000Z'
    expect(atrasadaAgora('pendente', '2026-10-17T14:59:00.000Z', agora)).toBe(true)
    expect(atrasadaAgora('pendente', '2026-10-17T15:01:00.000Z', agora)).toBe(false)
    expect(atrasadaAgora('feito', '2026-10-01T10:00:00.000Z', agora)).toBe(false)
  })
})
