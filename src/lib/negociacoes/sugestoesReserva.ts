import type { Etapa } from './negociacoes'

export type NegSugestao = { id: string; clienteId: string; saidaId: string | null; etapa: Etapa; criadoEm: string }
export type ReservaSugestao = {
  id: string; clienteId: string; saidaId: string; situacao: 'ativa' | 'cancelada'; valorTotal: number; saldo: number; criadaEm: string
}
export type Dispensa = { negociacaoId: string; reservaId: string; para: 'reservado' | 'pago' }
export type Sugestao = { para: 'reservado' | 'pago'; reservaId: string }

const ANTES_DE_RESERVADO: Etapa[] = ['interessado', 'orcamento']

// Automation 6: a reservation suggests Reservado; a fully paid one suggests Pago. Never applied automatically.
// A deal tied to a departure matches only that departure; otherwise, reservations made after the deal was created.
export function sugerirEtapas(negs: NegSugestao[], reservas: ReservaSugestao[], dispensas: Dispensa[]): Map<string, Sugestao> {
  const dispensada = new Set(dispensas.map((d) => `${d.negociacaoId}|${d.reservaId}|${d.para}`))
  const ativas = reservas.filter((r) => r.situacao === 'ativa').sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))
  const sugestoes = new Map<string, Sugestao>()

  for (const n of negs) {
    if (!ANTES_DE_RESERVADO.includes(n.etapa) && n.etapa !== 'reservado') continue
    const candidatas = ativas.filter((r) => r.clienteId === n.clienteId && (n.saidaId ? r.saidaId === n.saidaId : r.criadaEm >= n.criadoEm))
    const livre = (r: ReservaSugestao, para: Sugestao['para']) => !dispensada.has(`${n.id}|${r.id}|${para}`)

    const quitada = candidatas.find((r) => r.valorTotal > 0 && r.saldo <= 0 && livre(r, 'pago'))
    if (quitada) {
      sugestoes.set(n.id, { para: 'pago', reservaId: quitada.id })
      continue
    }
    const reservada = ANTES_DE_RESERVADO.includes(n.etapa) ? candidatas.find((r) => livre(r, 'reservado')) : undefined
    if (reservada) sugestoes.set(n.id, { para: 'reservado', reservaId: reservada.id })
  }
  return sugestoes
}
