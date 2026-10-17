import { describe, expect, test } from 'vitest'
import { sugerirEtapas, type NegSugestao, type ReservaSugestao } from './sugestoesReserva'

const neg = (p: Partial<NegSugestao>): NegSugestao => ({ id: 'n1', clienteId: 'c1', saidaId: null, etapa: 'interessado', criadoEm: '2026-10-01T12:00:00Z', ...p })
const res = (p: Partial<ReservaSugestao>): ReservaSugestao => ({
  id: 'r1', clienteId: 'c1', saidaId: 's1', situacao: 'ativa', valorTotal: 100_000, saldo: 100_000, criadaEm: '2026-10-05T12:00:00Z', ...p,
})

describe('sugerirEtapas', () => {
  test('a reservation for the client suggests Reservado', () => {
    expect(sugerirEtapas([neg({})], [res({})], []).get('n1')).toEqual({ para: 'reservado', reservaId: 'r1' })
  })
  test('a fully paid reservation suggests Pago (also from Reservado)', () => {
    expect(sugerirEtapas([neg({ etapa: 'reservado' })], [res({ saldo: 0 })], []).get('n1')).toEqual({ para: 'pago', reservaId: 'r1' })
    expect(sugerirEtapas([neg({})], [res({ saldo: -500 })], []).get('n1')?.para).toBe('pago')
  })
  test('a deal already in Reservado with an unpaid reservation gets nothing', () => {
    expect(sugerirEtapas([neg({ etapa: 'reservado' })], [res({})], []).size).toBe(0)
  })
  test('won or lost deals never get suggestions', () => {
    for (const etapa of ['pago', 'viajou', 'pos_venda', 'perdido'] as const) {
      expect(sugerirEtapas([neg({ etapa })], [res({ saldo: 0 })], []).size).toBe(0)
    }
  })
  test('cancelled reservations, other clients and zero-value "paid" do not count', () => {
    expect(sugerirEtapas([neg({})], [res({ situacao: 'cancelada' })], []).size).toBe(0)
    expect(sugerirEtapas([neg({})], [res({ clienteId: 'c2' })], []).size).toBe(0)
    expect(sugerirEtapas([neg({})], [res({ valorTotal: 0, saldo: 0 })], []).get('n1')?.para).toBe('reservado')
  })
  test('a deal tied to a departure only matches reservations on that departure', () => {
    expect(sugerirEtapas([neg({ saidaId: 's2' })], [res({ saidaId: 's1' })], []).size).toBe(0)
    expect(sugerirEtapas([neg({ saidaId: 's2' })], [res({ saidaId: 's2', criadaEm: '2026-01-01T12:00:00Z' })], []).get('n1')?.para).toBe('reservado')
  })
  test('without a departure, only reservations made after the deal was created', () => {
    expect(sugerirEtapas([neg({})], [res({ criadaEm: '2026-09-30T12:00:00Z' })], []).size).toBe(0)
  })
  test('the most recent matching reservation is used', () => {
    const r = sugerirEtapas([neg({})], [res({ id: 'velha', criadaEm: '2026-10-02T12:00:00Z' }), res({ id: 'nova', criadaEm: '2026-10-09T12:00:00Z' })], [])
    expect(r.get('n1')?.reservaId).toBe('nova')
  })
  test('"Agora não" hides that exact suggestion only', () => {
    expect(sugerirEtapas([neg({})], [res({})], [{ negociacaoId: 'n1', reservaId: 'r1', para: 'reservado' }]).size).toBe(0)
    // dismissing Pago still lets Reservado through for an open deal
    expect(sugerirEtapas([neg({})], [res({ saldo: 0 })], [{ negociacaoId: 'n1', reservaId: 'r1', para: 'pago' }]).get('n1')?.para).toBe('reservado')
    // a new reservation brings a new suggestion
    expect(sugerirEtapas([neg({})], [res({ id: 'r2' })], [{ negociacaoId: 'n1', reservaId: 'r1', para: 'reservado' }]).get('n1')?.reservaId).toBe('r2')
  })
})
