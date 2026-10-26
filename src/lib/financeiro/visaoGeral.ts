import { situacaoAPagar, type LinhaAPagar } from '@/lib/contas/contas'
import { totaisDoDia, type Movimento } from './conferencia'

export type ReservaVisao = { situacao: 'ativa' | 'cancelada'; criadaEm: string; valor: number; saldo: number }
export type VisaoGeral = {
  vendido: { valor: number; quantidade: number }
  recebido: number
  pago: number
  resultado: number
  aReceber: { valor: number; quantidade: number }
  aPagar: { vencido: number; aVencer: number }
}

// 'YYYY-MM' → last day of the month (day 0 of the next month, in UTC so no time zone shifts it).
export const fimDoMes = (mes: string) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10)

const somar = (xs: readonly { valor: number }[]) => xs.reduce((s, x) => s + x.valor, 0)

// R152: the month at a glance. `movimentos` are the month's (same source as the daily check, so the numbers match);
// to receive and to pay are today's snapshot, like Cobranças and Contas a pagar.
export function visaoGeral(
  d: { reservas: readonly ReservaVisao[]; movimentos: readonly Movimento[]; aPagar: readonly LinhaAPagar[] }, mes: string, hoje: string,
): VisaoGeral {
  const ativas = d.reservas.filter((r) => r.situacao === 'ativa')
  const doMes = ativas.filter((r) => r.criadaEm.startsWith(`${mes}-`))
  const emAberto = ativas.filter((r) => r.saldo > 0)
  const estornos = somar(d.movimentos.filter((m) => m.origem === 'estorno'))
  const t = totaisDoDia(d.movimentos)
  const abertas = d.aPagar.filter((l) => !l.pagoEm)
  const vencido = somar(abertas.filter((l) => situacaoAPagar(l, hoje) === 'vencida'))
  return {
    vendido: { valor: somar(doMes), quantidade: doMes.length },
    recebido: t.entradas - estornos,
    pago: t.saidas - estornos,
    resultado: t.saldo,
    aReceber: { valor: emAberto.reduce((s, r) => s + r.saldo, 0), quantidade: emAberto.length },
    aPagar: { vencido, aVencer: somar(abertas) - vencido },
  }
}
