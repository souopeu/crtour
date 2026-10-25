import { describe, expect, it } from 'vitest'
import { mensagemDeErroReserva } from '@/lib/reservas/schema'
import { NOME_A_INFORMAR } from '@/lib/passageiros/lista'
import { contarEmbarque, lugarSchema, montarEmbarque, type EmbarqueFeito } from './embarque'

const reservas = [
  { id: 'r1', cliente_nome: 'Ana', qtd_pessoas: 3, situacao: 'ativa' as const },
  { id: 'r2', cliente_nome: 'Caio', qtd_pessoas: 1, situacao: 'ativa' as const },
  { id: 'r3', cliente_nome: 'Cancelada', qtd_pessoas: 2, situacao: 'cancelada' as const },
]
const passageiros = [{ id: 'p1', reserva_id: 'r1', nome: 'Beto' }]

describe('montarEmbarque (R141)', () => {
  it('has one place per person travelling: responsible, named companions, then unnamed places', () => {
    const lugares = montarEmbarque(reservas, passageiros, [])
    expect(lugares.map((l) => [l.reservaId, l.nome, l.tipo, l.passageiroId, l.vaga])).toEqual([
      ['r1', 'Ana', 'Responsável', null, 0],
      ['r1', 'Beto', 'Acompanhante', 'p1', 0],
      ['r1', NOME_A_INFORMAR, 'Acompanhante', null, 1],
      ['r2', 'Caio', 'Responsável', null, 0],
    ])
    expect(new Set(lugares.map((l) => l.chave)).size).toBe(lugares.length)
  })

  it('shows who boarded, when and who marked', () => {
    const feitos: EmbarqueFeito[] = [
      { reserva_id: 'r1', passageiro_id: 'p1', vaga: 0, embarcou_em: '2027-09-01T11:00:00Z', marcado_por: 'u1' },
      { reserva_id: 'r1', passageiro_id: null, vaga: 1, embarcou_em: '2027-09-01T11:05:00Z', marcado_por: null },
    ]
    const lugares = montarEmbarque(reservas, passageiros, feitos)
    expect(lugares.map((l) => l.embarque?.em ?? null)).toEqual([null, '2027-09-01T11:00:00Z', '2027-09-01T11:05:00Z', null])
    expect(lugares[1].embarque?.por).toBe('u1')
  })

  it('ignores a mark left on a place that no longer exists (the unnamed place got a name)', () => {
    const feitos: EmbarqueFeito[] = [{ reserva_id: 'r2', passageiro_id: null, vaga: 1, embarcou_em: '2027-09-01T11:00:00Z', marcado_por: null }]
    expect(contarEmbarque(montarEmbarque(reservas, passageiros, feitos))).toEqual({ embarcados: 0, total: 4 })
  })
})

describe('contarEmbarque', () => {
  it('counts people on board out of everyone travelling', () => {
    const feitos: EmbarqueFeito[] = [{ reserva_id: 'r1', passageiro_id: null, vaga: 0, embarcou_em: 'x', marcado_por: null }]
    expect(contarEmbarque(montarEmbarque(reservas, passageiros, feitos))).toEqual({ embarcados: 1, total: 4 })
  })
})

describe('lugarSchema', () => {
  it('reads a place from the form', () => {
    expect(lugarSchema.parse({ passageiro: '', vaga: '0', embarcou: '1' })).toEqual({ passageiro: null, vaga: 0, embarcou: true })
    const id = '5b3f1c2a-1d2e-4f50-8a6b-7c8d9e0f1a2b'
    expect(lugarSchema.parse({ passageiro: id, vaga: '0', embarcou: '0' })).toEqual({ passageiro: id, vaga: 0, embarcou: false })
  })

  it.each([
    ['bad companion id', { passageiro: 'x', vaga: '0', embarcou: '1' }],
    ['negative place', { passageiro: '', vaga: '-1', embarcou: '1' }],
    ['place too high', { passageiro: '', vaga: '500', embarcou: '1' }],
    ['unknown mark', { passageiro: '', vaga: '0', embarcou: 'talvez' }],
  ])('rejects %s', (_n, v) => {
    expect(lugarSchema.safeParse(v).success).toBe(false)
  })
})

it('explains why marking before the start is refused', () => {
  expect(mensagemDeErroReserva('CR021')).toMatch(/Inicie o embarque/)
})
