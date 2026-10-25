import { describe, expect, it } from 'vitest'
import { mensagemDeErroReserva } from '@/lib/reservas/schema'

it('explains the database refusals when moving (R140)', () => {
  expect(mensagemDeErroReserva('CR014')).toMatch(/mesmo passeio/)
  expect(mensagemDeErroReserva('CR001')).toMatch(/vagas/)
})
import { destinosParaMover, lerDia, ocupacao, ordenarPorHorario, type SaidaDestino } from './operacao'

const HOJE = '2026-10-25'

describe('lerDia (R139)', () => {
  it('reads a real date from the address and falls back to today', () => {
    expect(lerDia('2026-11-02', HOJE)).toBe('2026-11-02')
    expect(lerDia('2026-02-30', HOJE)).toBe(HOJE)
    expect(lerDia(['2026-11-02'], HOJE)).toBe(HOJE)
    expect(lerDia(undefined, HOJE)).toBe(HOJE)
  })
})

describe('ordenarPorHorario (R139)', () => {
  it('puts departures in time order, those without a time last, then by tour', () => {
    const saidas = [
      { id: 'c', horario: null, passeio: 'Barco' },
      { id: 'b', horario: '14:00:00', passeio: 'Praia' },
      { id: 'a', horario: '08:00:00', passeio: 'Serra' },
      { id: 'd', horario: null, passeio: 'Areia' },
    ]
    expect(ordenarPorHorario(saidas).map((s) => s.id)).toEqual(['a', 'b', 'd', 'c'])
    expect(saidas.map((s) => s.id)).toEqual(['c', 'b', 'a', 'd']) // the input is not changed
  })
})

describe('ocupacao', () => {
  it('gives the share of seats taken, from 0 to 100', () => {
    expect(ocupacao(0, 15)).toBe(0)
    expect(ocupacao(6, 15)).toBe(40)
    expect(ocupacao(20, 15)).toBe(100)
    expect(ocupacao(1, 0)).toBe(100)
  })
})

describe('destinosParaMover (R140)', () => {
  const s = (id: string, extra: Partial<SaidaDestino> = {}): SaidaDestino =>
    ({ id, passeioId: 'p1', data: '2026-11-10', situacao: 'aberta', livres: 5, ...extra })

  it('offers open departures of the same tour, from today on, with room for everyone', () => {
    const todas = [
      s('atual'),
      s('outro-passeio', { passeioId: 'p2' }),
      s('fechada', { situacao: 'encerrada' }),
      s('passada', { data: '2026-10-24' }),
      s('sem-lugar', { livres: 1 }),
      s('depois', { data: '2026-12-01' }),
      s('antes', { data: '2026-11-01' }),
      s('hoje', { data: HOJE }),
    ]
    expect(destinosParaMover(todas, 'atual', 'p1', 2, HOJE).map((d) => d.id)).toEqual(['hoje', 'antes', 'depois'])
  })
})
