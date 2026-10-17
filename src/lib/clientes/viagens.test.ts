import { describe, expect, test } from 'vitest'
import { saldoEmAberto, separarViagens, type Viagem } from './viagens'

const hoje = '2026-10-17'
const v = (extra: Partial<Viagem>): Viagem => ({
  reservaId: 'r', passeio: 'Lisboa', saidaData: '2027-03-10', qtd: 2, situacao: 'ativa',
  total: 200000, pago: 50000, saldo: 150000, papel: 'Responsável', ...extra,
})

describe('separarViagens', () => {
  test('upcoming (today included) ascending, past descending', () => {
    const r = separarViagens([
      v({ reservaId: 'a', saidaData: '2027-05-01' }),
      v({ reservaId: 'b', saidaData: '2026-10-17' }),
      v({ reservaId: 'c', saidaData: '2026-01-10' }),
      v({ reservaId: 'd', saidaData: '2025-06-01' }),
      v({ reservaId: 'e', saidaData: '2027-02-01' }),
    ], hoje)
    expect(r.futuras.map((x) => x.reservaId)).toEqual(['b', 'e', 'a'])
    expect(r.passadas.map((x) => x.reservaId)).toEqual(['c', 'd'])
  })
  test('empty input', () => {
    expect(separarViagens([], hoje)).toEqual({ futuras: [], passadas: [] })
  })
})

describe('saldoEmAberto', () => {
  test('sums the balance of active reservations the client is responsible for', () => {
    expect(saldoEmAberto([
      v({ saldo: 150000 }),
      v({ saldo: 30000 }),
      v({ saldo: 90000, situacao: 'cancelada' }),               // cancelled: not owed
      v({ saldo: 0 }),                                          // settled
      v({ saldo: 70000, papel: 'Acompanhante' }),               // someone else pays
      v({ saldo: -500 }),                                       // never negative
    ])).toBe(180000)
  })
  test('nothing owed', () => {
    expect(saldoEmAberto([])).toBe(0)
  })
})
