import { NEGOCIACOES } from './config'
import { ehGanha, type Etapa } from './negociacoes'

type Fechavel = { etapa: Etapa; fechado_em: string | null; valor_centavos: number }

/** Won deals (Pago, Viajou, Pós-venda) closed in the last N days, today included. */
export function ganhasRecentes(lista: Fechavel[], hoje: string, dias: number = NEGOCIACOES.DIAS_GANHAS_RECENTES) {
  const desde = new Date(Date.parse(`${hoje}T00:00:00Z`) - (dias - 1) * 86_400_000).toISOString().slice(0, 10)
  const ganhas = lista.filter((n) => ehGanha(n.etapa) && n.fechado_em !== null && n.fechado_em >= desde && n.fechado_em <= hoje)
  return { quantidade: ganhas.length, valor: ganhas.reduce((s, n) => s + n.valor_centavos, 0) }
}
