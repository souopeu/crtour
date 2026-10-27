import 'server-only'
import { z } from 'zod'
import { hojeNoBrasil } from '@/lib/formato'
import type { PassageiroDaLista, ReservaDaLista } from '@/lib/passageiros/lista'
import { criarClienteServidor } from '@/lib/supabase/server'
import { emBlocos } from '@/lib/consultas/emBlocos'

export type PasseioLinha = { id: string; nome: string; destino: string | null; descricao: string | null; inclui: string | null; nao_inclui: string | null; arquivado: boolean; tipo: 'individual' | 'excursao' | 'combo'; dias: number }
export type SaidaLinha = {
  id: string; passeio_id: string; data: string; capacidade: number; preco_centavos: number
  situacao: 'aberta' | 'encerrada' | 'cancelada'; reservadas: number; livres: number
  horario: string | null; veiculo_id: string | null // R138: 'HH:MM:SS' from the database
  embarque_iniciado_em: string | null // R141
}

const COLUNAS_PASSEIO = 'id, nome, destino, descricao, inclui, nao_inclui, arquivado, tipo, dias'
const COLUNAS_SAIDA = 'id, passeio_id, data, capacidade, preco_centavos, situacao, reservadas, livres, horario, veiculo_id, embarque_iniciado_em'
const uuid = (v: string) => z.uuid().safeParse(v).success

export async function listarPasseios(arquivados: boolean): Promise<(PasseioLinha & { proximaSaida: string | null; totalSaidas: number })[]> {
  const supabase = await criarClienteServidor()
  const [passeios, saidas] = await Promise.all([
    supabase.from('passeios').select(COLUNAS_PASSEIO).eq('arquivado', arquivados).eq('sob_medida', false).order('nome'), // R142: one-off services are not catalogue tours
    supabase.from('saidas').select('passeio_id, data').neq('situacao', 'cancelada').order('data').limit(5000),
  ])
  const hoje = hojeNoBrasil()
  const porPasseio = new Map<string, string[]>()
  for (const s of (saidas.data ?? []) as { passeio_id: string; data: string }[]) {
    porPasseio.set(s.passeio_id, [...(porPasseio.get(s.passeio_id) ?? []), s.data])
  }
  return ((passeios.data ?? []) as PasseioLinha[]).map((p) => {
    const datas = porPasseio.get(p.id) ?? []
    return { ...p, totalSaidas: datas.length, proximaSaida: datas.find((d) => d >= hoje) ?? null }
  })
}

export async function buscarPasseio(id: string): Promise<PasseioLinha | null> {
  if (!uuid(id)) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('passeios').select(COLUNAS_PASSEIO).eq('id', id).maybeSingle()
  return (data as PasseioLinha | null) ?? null
}

export async function listarSaidas(passeioId: string): Promise<SaidaLinha[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('v_saidas_vagas').select(COLUNAS_SAIDA).eq('passeio_id', passeioId).order('data').order('horario', { nullsFirst: true })
  return (data ?? []) as SaidaLinha[]
}

export async function buscarSaida(id: string): Promise<(SaidaLinha & { passeio_nome: string }) | null> {
  if (!uuid(id)) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('v_saidas_vagas').select(COLUNAS_SAIDA).eq('id', id).maybeSingle()
  if (!data) return null
  const saida = data as SaidaLinha
  const passeio = await buscarPasseio(saida.passeio_id)
  return { ...saida, passeio_nome: passeio?.nome ?? '' }
}

export type PassageiroLinha = { id: string; nome: string; whatsapp: string | null }
export type ReservaLinha = {
  id: string; cliente_id: string; cliente_nome: string; qtd_pessoas: number
  valor_total_centavos: number; situacao: 'ativa' | 'cancelada'; observacao: string | null
  pago_centavos: number; saldo_centavos: number; vencimento_saldo: string | null
  passageiros: PassageiroLinha[]
}

export async function listarReservas(saidaId: string): Promise<ReservaLinha[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('v_reservas_saldo')
    .select('id, cliente_id, qtd_pessoas, valor_total_centavos, situacao, observacao, pago_centavos, saldo_centavos, vencimento_saldo')
    .eq('saida_id', saidaId)
    .order('criada_em')
  const reservas = (data ?? []) as Omit<ReservaLinha, 'cliente_nome' | 'passageiros'>[]
  const ids = [...new Set(reservas.map((r) => r.cliente_id))]
  const nomes = new Map<string, string>()
  if (ids.length > 0) {
    const { data: clientes } = await emBlocos(ids, (b) => supabase.from('clientes').select('id, nome').in('id', b))
    for (const c of (clientes ?? []) as { id: string; nome: string }[]) nomes.set(c.id, c.nome)
  }
  const porReserva = new Map<string, PassageiroLinha[]>()
  if (reservas.length > 0) {
    const { data: ps } = await emBlocos(reservas.map((r) => r.id), (b) => supabase
      .from('passageiros')
      .select('id, reserva_id, nome, whatsapp')
      .in('reserva_id', b)
      .order('criado_em'))
    for (const p of (ps ?? []) as (PassageiroLinha & { reserva_id: string })[]) {
      porReserva.set(p.reserva_id, [...(porReserva.get(p.reserva_id) ?? []), { id: p.id, nome: p.nome, whatsapp: p.whatsapp }])
    }
  }
  return reservas.map((r) => ({ ...r, cliente_nome: nomes.get(r.cliente_id) ?? 'Cliente', passageiros: porReserva.get(r.id) ?? [] }))
}

export async function buscarClientesParaReserva(busca: string): Promise<{ id: string; nome: string; whatsapp: string | null; cidade: string | null }[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.rpc('buscar_clientes', { p_busca: busca || null, p_limite: 8 })
  return ((data ?? []) as { id: string; nome: string; whatsapp: string | null; cidade: string | null }[]).map(({ id, nome, whatsapp, cidade }) => ({ id, nome, whatsapp, cidade }))
}

export async function buscarNomeDoCliente(id: string): Promise<string | null> {
  if (!uuid(id)) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('clientes').select('nome').eq('id', id).maybeSingle()
  return (data as { nome: string } | null)?.nome ?? null
}

// Everything the printable list needs: active reservations (with the responsible's phone) and companions.
export async function listarPassageirosDaSaida(saidaId: string): Promise<{ reservas: ReservaDaLista[]; passageiros: PassageiroDaLista[] }> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('reservas')
    .select('id, cliente_id, qtd_pessoas, situacao')
    .eq('saida_id', saidaId)
    .eq('situacao', 'ativa')
    .order('criada_em')
  const base = (data ?? []) as { id: string; cliente_id: string; qtd_pessoas: number; situacao: 'ativa' | 'cancelada' }[]
  if (base.length === 0) return { reservas: [], passageiros: [] }

  const [clientes, ps] = await Promise.all([
    emBlocos([...new Set(base.map((r) => r.cliente_id))], (b) => supabase.from('clientes').select('id, nome, whatsapp').in('id', b)),
    emBlocos(base.map((r) => r.id), (b) => supabase.from('passageiros').select('reserva_id, nome, whatsapp').in('reserva_id', b).order('criado_em')),
  ])
  const porCliente = new Map(((clientes.data ?? []) as { id: string; nome: string; whatsapp: string | null }[]).map((c) => [c.id, c]))
  return {
    reservas: base.map((r) => ({
      id: r.id,
      cliente_nome: porCliente.get(r.cliente_id)?.nome ?? 'Cliente',
      cliente_whatsapp: porCliente.get(r.cliente_id)?.whatsapp ?? null,
      qtd_pessoas: r.qtd_pessoas,
      situacao: r.situacao,
    })),
    passageiros: (ps.data ?? []) as PassageiroDaLista[],
  }
}

// R164: itinerary of an excursion, by day.
export async function roteiroDoPasseio(passeioId: string): Promise<{ dia: number; titulo: string; descricao: string | null }[]> {
  if (!uuid(passeioId)) return []
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('passeio_dias').select('dia, titulo, descricao').eq('passeio_id', passeioId).order('dia')
  if (error) console.error('roteiroDoPasseio falhou', error.code)
  return data ?? []
}
