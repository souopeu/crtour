import { describe, expect, it } from 'vitest'
import { sobMedidaSchema } from './sobMedida'

const CLIENTE = '5b3f1c2a-1d2e-4f50-8a6b-7c8d9e0f1a2b'
const ok = { cliente: CLIENTE, nome: ' Transfer aeroporto ', data: '2027-10-05', horario: '06:30', pessoas: '3', valor: '450,00', observacao: '' }

describe('sobMedidaSchema (R142)', () => {
  it('reads the service into what the database expects', () => {
    expect(sobMedidaSchema.parse(ok)).toEqual({
      p_cliente: CLIENTE, p_nome: 'Transfer aeroporto', p_data: '2027-10-05', p_horario: '06:30', p_qtd: 3, p_valor_total: 45000, p_observacao: null,
    })
  })

  it('leaves the time out when empty and keeps a note', () => {
    expect(sobMedidaSchema.parse({ ...ok, horario: '', observacao: ' Voo 1234 ' })).toMatchObject({ p_horario: null, p_observacao: 'Voo 1234' })
  })

  it.each([
    ['no client', { cliente: '' }],
    ['no name', { nome: '  ' }],
    ['long name', { nome: 'a'.repeat(121) }],
    ['impossible date', { data: '2027-02-30' }],
    ['bad time', { horario: '25:00' }],
    ['zero people', { pessoas: '0' }],
    ['too many people', { pessoas: '501' }],
    ['bad total', { valor: 'caro' }],
    ['long note', { observacao: 'a'.repeat(1001) }],
  ])('rejects %s', (_n, parcial) => {
    expect(sobMedidaSchema.safeParse({ ...ok, ...parcial }).success).toBe(false)
  })
})
