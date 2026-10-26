import { describe, expect, it } from 'vitest'
import type { LinhaAPagar } from '@/lib/contas/contas'
import type { Movimento } from './conferencia'
import { fimDoMes, visaoGeral } from './visaoGeral'

const mov = (sentido: Movimento['sentido'], origem: Movimento['origem'], valor: number): Movimento => ({ id: 'm', sentido, origem, descricao: 'd', valor, forma: 'pix' })
const conta = (valor: number, vencimento: string | null, pagoEm: string | null = null): LinhaAPagar => ({
  origem: 'conta', id: 'c', descricao: 'd', categoria: 'Outros', valor, vencimento, pagoEm, fornecedor: null, parcela: null, href: '/x',
})

describe('fimDoMes', () => {
  it('gives the last day, leap years included', () => {
    expect(fimDoMes('2026-10')).toBe('2026-10-31')
    expect(fimDoMes('2028-02')).toBe('2028-02-29')
    expect(fimDoMes('2026-12')).toBe('2026-12-31')
  })
})

describe('visaoGeral', () => {
  const hoje = '2026-10-26'
  const v = visaoGeral({
    reservas: [
      { situacao: 'ativa', criadaEm: '2026-10-03', valor: 20000, saldo: 5000 },
      { situacao: 'cancelada', criadaEm: '2026-10-05', valor: 9000, saldo: 9000 },
      { situacao: 'ativa', criadaEm: '2026-09-30', valor: 10000, saldo: 3000 },
      { situacao: 'ativa', criadaEm: '2026-10-10', valor: 4000, saldo: 0 },
    ],
    movimentos: [
      mov('entrada', 'pagamento', 15000), mov('saida', 'estorno', 1000),
      mov('saida', 'conta', 2000), mov('saida', 'custo', 500), mov('saida', 'comissao', 700),
    ],
    aPagar: [conta(1000, '2026-10-20'), conta(2500, '2026-11-02'), conta(300, null), conta(999, '2026-10-01', '2026-10-01')],
  }, '2026-10', hoje)

  it('sells only active reservations created in the month', () => {
    expect(v.vendido).toEqual({ valor: 24000, quantidade: 2 })
  })
  it('receives payments minus refunds, and pays everything else that went out', () => {
    expect(v.recebido).toBe(14000)
    expect(v.pago).toBe(3200)
    expect(v.resultado).toBe(10800)
  })
  it('counts open balances of active reservations, whatever the month', () => {
    expect(v.aReceber).toEqual({ valor: 8000, quantidade: 2 })
  })
  it('splits what is still to pay into overdue and not yet due (no due date counts as not yet due)', () => {
    expect(v.aPagar).toEqual({ vencido: 1000, aVencer: 2800 })
  })
})
