import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarSaidasParaSelecao } from './dados'
import { sugerirEtapas, type Sugestao } from './sugestoesReserva'

const ETAPAS_COM_SUGESTAO = ['interessado', 'orcamento', 'reservado'] as const
const negSchema = z.object({ id: z.uuid(), cliente_id: z.uuid(), saida_id: z.uuid(), etapa: z.enum(ETAPAS_COM_SUGESTAO) })
const resSchema = z.object({
  id: z.uuid(), cliente_id: z.uuid(), saida_id: z.uuid(), situacao: z.enum(['ativa', 'cancelada']),
  valor_total_centavos: z.number(), saldo_centavos: z.number(), criada_em: z.string(),
})
const dispSchema = z.object({ negociacao_id: z.uuid(), reserva_id: z.uuid(), para: z.enum(['reservado', 'pago']) })

export type SugestaoComTexto = Sugestao & { texto: string }

// Suggestions for open deals (optionally one deal), with a sentence naming the reservation's departure.
export async function carregarSugestoes(negociacaoId?: string): Promise<Map<string, SugestaoComTexto>> {
  const supabase = await criarClienteServidor()
  let consulta = supabase.from('negociacoes').select('id, cliente_id, saida_id, etapa').in('etapa', [...ETAPAS_COM_SUGESTAO]).not('saida_id', 'is', null).limit(2000)
  if (negociacaoId) consulta = consulta.eq('id', negociacaoId)
  const negs = z.array(negSchema).catch([]).parse((await consulta).data ?? [])
  if (negs.length === 0) return new Map()

  const clientes = [...new Set(negs.map((n) => n.cliente_id))]
  const [reservas, dispensas, saidas] = await Promise.all([
    supabase.from('v_reservas_saldo').select('id, cliente_id, saida_id, situacao, valor_total_centavos, saldo_centavos, criada_em').in('cliente_id', clientes).eq('situacao', 'ativa'),
    supabase.from('sugestoes_dispensadas').select('negociacao_id, reserva_id, para').in('negociacao_id', negs.map((n) => n.id)),
    listarSaidasParaSelecao(),
  ])
  const res = z.array(resSchema).catch([]).parse(reservas.data ?? [])
  const rotulo = new Map(saidas.map((s) => [s.id, s.rotulo]))
  const saidaDa = new Map(res.map((r) => [r.id, r.saida_id]))

  const sugestoes = sugerirEtapas(
    negs.map((n) => ({ id: n.id, clienteId: n.cliente_id, saidaId: n.saida_id, etapa: n.etapa })),
    res.map((r) => ({ id: r.id, clienteId: r.cliente_id, saidaId: r.saida_id, situacao: r.situacao, valorTotal: r.valor_total_centavos, saldo: r.saldo_centavos, criadaEm: r.criada_em })),
    z.array(dispSchema).catch([]).parse(dispensas.data ?? []).map((d) => ({ negociacaoId: d.negociacao_id, reservaId: d.reserva_id, para: d.para })),
  )
  return new Map([...sugestoes].map(([id, s]) => {
    const saida = rotulo.get(saidaDa.get(s.reservaId) ?? '') ?? 'uma saída'
    const texto = s.para === 'pago' ? `A reserva em ${saida} está quitada.` : `O cliente tem reserva em ${saida}.`
    return [id, { ...s, texto }]
  }))
}
