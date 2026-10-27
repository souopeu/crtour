import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { Cobranca } from './extras'

export type ExtraLinha = {
  id: string; nome: string; preco_centavos: number; custo_centavos: number | null
  cobranca: Cobranca; todos_passeios: boolean; ativo: boolean
}
export type ItemReserva = { id: string; nome: string; preco_centavos: number; custo_centavos: number | null; quantidade: number }

const COLUNAS = 'id, nome, preco_centavos, custo_centavos, cobranca, todos_passeios, ativo'
const uuid = (v: string) => z.uuid().safeParse(v).success

export async function listarExtras(): Promise<(ExtraLinha & { passeios: string[] })[] | null> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('extras').select(`${COLUNAS}, extras_passeios(passeios(nome))`).order('ativo', { ascending: false }).order('nome')
  if (error) {
    console.error('listarExtras falhou', error.code)
    return null
  }
  type Linha = ExtraLinha & { extras_passeios: { passeios: { nome: string } | null }[] }
  return (data as unknown as Linha[]).map(({ extras_passeios, ...e }) => ({
    ...e, passeios: extras_passeios.map((ep) => ep.passeios?.nome ?? '').filter(Boolean),
  }))
}

export async function buscarExtra(id: string): Promise<(ExtraLinha & { passeios: string[] }) | null> {
  if (!uuid(id)) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('extras').select(`${COLUNAS}, extras_passeios(passeio_id)`).eq('id', id).maybeSingle()
  if (!data) return null
  const { extras_passeios, ...e } = data as unknown as ExtraLinha & { extras_passeios: { passeio_id: string }[] }
  return { ...e, passeios: extras_passeios.map((ep) => ep.passeio_id) }
}

export async function listarPasseiosParaExtra(): Promise<{ id: string; nome: string }[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('passeios').select('id, nome').eq('arquivado', false).eq('sob_medida', false).order('nome')
  return data ?? []
}

// Active extras that can be sold on this tour (same rule as private.inserir_item).
export async function extrasDoPasseio(passeioId: string): Promise<ExtraLinha[]> {
  if (!uuid(passeioId)) return []
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('extras').select(`${COLUNAS}, extras_passeios(passeio_id)`).eq('ativo', true).order('nome')
  type Linha = ExtraLinha & { extras_passeios: { passeio_id: string }[] }
  return ((data ?? []) as unknown as Linha[])
    .filter((e) => e.todos_passeios || e.extras_passeios.some((ep) => ep.passeio_id === passeioId))
    .map((e) => ({ id: e.id, nome: e.nome, preco_centavos: e.preco_centavos, custo_centavos: e.custo_centavos, cobranca: e.cobranca, todos_passeios: e.todos_passeios, ativo: e.ativo }))
}

export async function itensDaReserva(reservaId: string): Promise<ItemReserva[]> {
  if (!uuid(reservaId)) return []
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('reserva_itens').select('id, nome, preco_centavos, custo_centavos, quantidade').eq('reserva_id', reservaId).order('criado_em')
  return data ?? []
}
