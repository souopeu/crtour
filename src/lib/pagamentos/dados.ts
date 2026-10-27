import 'server-only'
import { z } from 'zod'
import type { FiltroCobranca } from './cobranca'
import { passaFiltro } from './cobranca'
import { criarClienteServidor } from '@/lib/supabase/server'
import { emBlocos } from '@/lib/consultas/emBlocos'
import type { StatusOperacional } from '@/lib/reservas/status'

export type ReservaDetalhe = {
  id: string; saida_id: string; cliente_id: string; cliente_nome: string; qtd_pessoas: number
  valor_total_centavos: number; pago_centavos: number; saldo_centavos: number
  vencimento_saldo: string | null; situacao: 'ativa' | 'cancelada'; status_operacional: StatusOperacional
  saida_data: string; passeio_id: string; passeio_nome: string
}
export type PagamentoLinha = {
  id: string; tipo: 'sinal' | 'parcela' | 'saldo' | 'estorno'; forma: string; valor_centavos: number
  data: string; observacao: string | null; estorno_de: string | null; estornado: boolean
}

export async function buscarReserva(id: string): Promise<ReservaDetalhe | null> {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('v_reservas_saldo')
    .select('id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos, pago_centavos, saldo_centavos, vencimento_saldo, situacao, status_operacional')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const r = data as Omit<ReservaDetalhe, 'cliente_nome' | 'saida_data' | 'passeio_id' | 'passeio_nome'>
  const [cliente, saida] = await Promise.all([
    supabase.from('clientes').select('nome').eq('id', r.cliente_id).maybeSingle(),
    supabase.from('saidas').select('data, passeio_id').eq('id', r.saida_id).maybeSingle(),
  ])
  const s = saida.data as { data: string; passeio_id: string } | null
  const passeio = s ? await supabase.from('passeios').select('nome').eq('id', s.passeio_id).maybeSingle() : null
  return {
    ...r,
    cliente_nome: (cliente.data as { nome: string } | null)?.nome ?? 'Cliente',
    saida_data: s?.data ?? '',
    passeio_id: s?.passeio_id ?? '',
    passeio_nome: (passeio?.data as { nome: string } | null)?.nome ?? '',
  }
}

export async function listarPagamentos(reservaId: string): Promise<PagamentoLinha[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('pagamentos')
    .select('id, tipo, forma, valor_centavos, data, observacao, estorno_de')
    .eq('reserva_id', reservaId)
    .order('data')
    .order('criado_em')
  const linhas = (data ?? []) as Omit<PagamentoLinha, 'estornado'>[]
  const estornados = new Set(linhas.map((l) => l.estorno_de).filter(Boolean) as string[])
  return linhas.map((l) => ({ ...l, estornado: estornados.has(l.id) }))
}

export type Cobranca = {
  reservaId: string; clienteId: string; clienteNome: string; clienteWhatsapp: string | null; consentimento: string
  passeio: string; saidaData: string; total: number; pago: number; saldo: number; vencimento: string | null; tarifa: 'balcao' | 'b2b'
}

// Active reservations with a balance, filtered and sorted by due date (no date last).
export async function listarCobrancas(filtro: FiltroCobranca, hoje: string, tarifa: 'balcao' | 'b2b' | null = null): Promise<Cobranca[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('v_reservas_saldo')
    .select('id, saida_id, cliente_id, valor_total_centavos, pago_centavos, saldo_centavos, vencimento_saldo, tarifa')
    .eq('situacao', 'ativa')
    .gt('saldo_centavos', 0)
    .in('tarifa', tarifa ? [tarifa] : ['balcao', 'b2b'])
    .limit(2000)
  const reservas = ((data ?? []) as { id: string; saida_id: string; cliente_id: string; valor_total_centavos: number; pago_centavos: number; saldo_centavos: number; vencimento_saldo: string | null; tarifa: 'balcao' | 'b2b' }[])
    .filter((r) => passaFiltro({ saldo: r.saldo_centavos, vencimento: r.vencimento_saldo }, filtro, hoje))
  if (reservas.length === 0) return []

  const [clientes, saidas] = await Promise.all([
    emBlocos([...new Set(reservas.map((r) => r.cliente_id))], (b) => supabase.from('clientes').select('id, nome, whatsapp, consentimento_whatsapp').in('id', b)),
    emBlocos([...new Set(reservas.map((r) => r.saida_id))], (b) => supabase.from('saidas').select('id, data, passeio_id').in('id', b)),
  ])
  const porCliente = new Map(((clientes.data ?? []) as { id: string; nome: string; whatsapp: string | null; consentimento_whatsapp: string }[]).map((c) => [c.id, c]))
  const saidasLinhas = (saidas.data ?? []) as { id: string; data: string; passeio_id: string }[]
  const passeios = await emBlocos([...new Set(saidasLinhas.map((s) => s.passeio_id))], (b) => supabase.from('passeios').select('id, nome').in('id', b))
  const nomePasseio = new Map(((passeios.data ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]))
  const porSaida = new Map(saidasLinhas.map((s) => [s.id, s]))

  return reservas
    .map((r) => {
      const c = porCliente.get(r.cliente_id)
      const s = porSaida.get(r.saida_id)
      return {
        reservaId: r.id, clienteId: r.cliente_id, clienteNome: c?.nome ?? 'Cliente', clienteWhatsapp: c?.whatsapp ?? null,
        consentimento: c?.consentimento_whatsapp ?? 'nao_informado', passeio: s ? (nomePasseio.get(s.passeio_id) ?? '') : '',
        saidaData: s?.data ?? '', total: r.valor_total_centavos, pago: r.pago_centavos, saldo: r.saldo_centavos, vencimento: r.vencimento_saldo, tarifa: r.tarifa,
      }
    })
    .sort((a, b) => (a.vencimento ?? '9999-12-31').localeCompare(b.vencimento ?? '9999-12-31') || a.clienteNome.localeCompare(b.clienteNome))
}
