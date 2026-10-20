import 'server-only'
import type { AvisoLinha } from '@/lib/avisos/avisos'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import { NEGOCIACOES } from './config'
import { ETAPAS_ABERTAS, type Etapa, type Motivo } from './negociacoes'
import { emBlocos } from '@/lib/consultas/emBlocos'

export type NegociacaoLinha = {
  id: string; cliente_id: string; cliente_nome: string; titulo: string; valor_centavos: number; etapa: Etapa
  probabilidade: number; valor_previsto_centavos: number; responsavel_id: string | null; responsavel_nome: string | null
  data_fechamento_esperada: string | null; saida_id: string | null; fechado_em: string | null; etapa_desde: string
  motivo_perda: Motivo | null; motivo_texto: string | null
}
export type MembroLinha = { user_id: string; nome: string }
export type EventoLinha = { id: string; de: Etapa | null; para: Etapa; por_nome: string | null; em: string; motivo: Motivo | null }

const COLUNAS = 'id, cliente_id, titulo, valor_centavos, etapa, probabilidade, valor_previsto_centavos, responsavel_id, data_fechamento_esperada, saida_id, fechado_em, etapa_desde, motivo_perda, motivo_texto'

export async function listarMembros(): Promise<MembroLinha[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('membros').select('user_id, nome').order('nome')
  return (data ?? []) as MembroLinha[]
}

async function completar(linhas: Omit<NegociacaoLinha, 'cliente_nome' | 'responsavel_nome'>[]): Promise<NegociacaoLinha[]> {
  if (linhas.length === 0) return []
  const supabase = await criarClienteServidor()
  const [clientes, membros] = await Promise.all([
    emBlocos([...new Set(linhas.map((l) => l.cliente_id))], (b) => supabase.from('clientes').select('id, nome').in('id', b)),
    listarMembros(),
  ])
  const nomeCliente = new Map(((clientes.data ?? []) as { id: string; nome: string }[]).map((c) => [c.id, c.nome]))
  const nomeMembro = new Map(membros.map((m) => [m.user_id, m.nome]))
  return linhas.map((l) => ({
    ...l,
    cliente_nome: nomeCliente.get(l.cliente_id) ?? 'Cliente',
    responsavel_nome: l.responsavel_id ? (nomeMembro.get(l.responsavel_id) ?? null) : null,
  }))
}

// Every open deal, plus the most recently moved closed ones; a single capped list used to drop old open deals.
export async function listarNegociacoes(): Promise<NegociacaoLinha[]> {
  const supabase = await criarClienteServidor()
  const abertas = `(${ETAPAS_ABERTAS.join(',')})`
  const [a, f] = await Promise.all([
    supabase.from('negociacoes').select(`${COLUNAS}, criado_em`).in('etapa', ETAPAS_ABERTAS).order('criado_em', { ascending: false }).limit(NEGOCIACOES.MAX_ABERTAS),
    supabase.from('negociacoes').select(`${COLUNAS}, criado_em`).not('etapa', 'in', abertas).order('etapa_desde', { ascending: false }).limit(NEGOCIACOES.MAX_FECHADAS),
  ])
  if (a.error || f.error) console.error('listarNegociacoes falhou', (a.error ?? f.error)?.code)
  const linhas = [...(a.data ?? []), ...(f.data ?? [])] as (Omit<NegociacaoLinha, 'cliente_nome' | 'responsavel_nome'> & { criado_em: string })[]
  return completar(linhas.sort((x, y) => y.criado_em.localeCompare(x.criado_em)))
}

export async function listarNegociacoesDoCliente(clienteId: string): Promise<NegociacaoLinha[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('negociacoes').select(COLUNAS).eq('cliente_id', clienteId).order('criado_em', { ascending: false })
  return completar((data ?? []) as Omit<NegociacaoLinha, 'cliente_nome' | 'responsavel_nome'>[])
}

export async function buscarNegociacao(id: string): Promise<NegociacaoLinha | null> {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('negociacoes').select(COLUNAS).eq('id', id).maybeSingle()
  if (!data) return null
  return (await completar([data as Omit<NegociacaoLinha, 'cliente_nome' | 'responsavel_nome'>]))[0]
}

export async function listarEventos(negociacaoId: string): Promise<EventoLinha[]> {
  const supabase = await criarClienteServidor()
  const [eventos, membros] = await Promise.all([
    supabase.from('negociacao_eventos').select('id, de, para, por, em, motivo').eq('negociacao_id', negociacaoId).order('em', { ascending: false }),
    listarMembros(),
  ])
  const nome = new Map(membros.map((m) => [m.user_id, m.nome]))
  return ((eventos.data ?? []) as { id: string; de: Etapa | null; para: Etapa; por: string | null; em: string; motivo: Motivo | null }[]).map((e) => ({
    id: e.id, de: e.de, para: e.para, em: e.em, motivo: e.motivo, por_nome: e.por ? (nome.get(e.por) ?? null) : null,
  }))
}

export type SaidaOpcao = { id: string; rotulo: string }

// Upcoming and recent departures (not cancelled) to link a deal to a trip.
export async function listarSaidasParaSelecao(): Promise<SaidaOpcao[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('saidas').select('id, data, passeio_id').neq('situacao', 'cancelada').order('data', { ascending: false }).limit(200)
  const saidas = (data ?? []) as { id: string; data: string; passeio_id: string }[]
  if (saidas.length === 0) return []
  const { data: passeios } = await emBlocos([...new Set(saidas.map((s) => s.passeio_id))], (b) => supabase.from('passeios').select('id, nome').in('id', b))
  const nome = new Map(((passeios ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]))
  return saidas.map((s) => ({ id: s.id, rotulo: `${nome.get(s.passeio_id) ?? 'Passeio'} · ${s.data.split('-').reverse().join('/')}` }))
}

// R128: RLS returns each person's own notices, plus the agency-wide ones to the owner.
export async function listarAvisos(limite = 100): Promise<AvisoLinha[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('avisos')
    .select('id, tipo, titulo, cliente_nome, valor_centavos, por_nome, lido_em, criado_em, negociacao_id, reserva_id, saida_id, atividade:atividades(cliente_id)')
    .order('criado_em', { ascending: false })
    .limit(limite)
  return (data ?? []) as unknown as AvisoLinha[]
}

export async function contarAvisosNaoLidos(): Promise<number> {
  const supabase = await criarClienteServidor()
  const { count } = await supabase.from('avisos').select('id', { count: 'exact', head: true }).is('lido_em', null)
  return count ?? 0
}
