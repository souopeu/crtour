import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import { POR_PAGINA, type Filtros } from './filtros'
import type { LinhaCliente } from './formulario'

export const COLUNAS_CLIENTE =
  'nome, whatsapp, email, cidade, aniversario, origem, destinos_interesse, faixa_orcamento, qtd_pessoas, restricoes, passaporte_validade, consentimento_whatsapp'

// Returns null for malformed ids and for clients the caller cannot see (RLS).
export async function buscarCliente(id: string): Promise<(LinhaCliente & { id: string }) | null> {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('clientes').select(`id, ${COLUNAS_CLIENTE}`).eq('id', id).maybeSingle()
  return (data as (LinhaCliente & { id: string }) | null) ?? null
}

export type EtiquetaLinha = { id: string; nome: string }
export type AnotacaoLinha = { id: string; autor_id: string | null; autor_nome: string; texto: string; criada_em: string }

export async function buscarEtiquetas(clienteId: string): Promise<{ aplicadas: EtiquetaLinha[]; todas: EtiquetaLinha[] }> {
  const supabase = await criarClienteServidor()
  const [vinculos, todas] = await Promise.all([
    supabase.from('cliente_etiquetas').select('etiqueta_id').eq('cliente_id', clienteId),
    supabase.from('etiquetas').select('id, nome').order('nome'),
  ])
  const ids = new Set((vinculos.data ?? []).map((v) => v.etiqueta_id as string))
  const lista = (todas.data ?? []) as EtiquetaLinha[]
  return { aplicadas: lista.filter((e) => ids.has(e.id)), todas: lista }
}

export async function buscarAnotacoes(clienteId: string): Promise<AnotacaoLinha[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('anotacoes')
    .select('id, autor_id, autor_nome, texto, criada_em')
    .eq('cliente_id', clienteId)
    .order('criada_em', { ascending: false })
    .limit(100)
  return (data ?? []) as AnotacaoLinha[]
}

export type ClienteDaLista = {
  id: string
  nome: string
  whatsapp: string | null
  email: string | null
  cidade: string | null
  origem: string | null
  consentimento_whatsapp: string
  total: number
}

export async function listarClientes(f: Filtros): Promise<{ clientes: ClienteDaLista[]; total: number }> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('buscar_clientes', {
    p_busca: f.q || null,
    p_etiqueta: f.etiqueta,
    p_origem: f.origem,
    p_cidade: f.cidade || null,
    p_limite: POR_PAGINA,
    p_deslocamento: (f.pagina - 1) * POR_PAGINA,
  })
  if (error) {
    console.error('listarClientes falhou', error.code)
    return { clientes: [], total: 0 }
  }
  const clientes = (data ?? []) as ClienteDaLista[]
  return { clientes, total: clientes[0]?.total ?? 0 }
}

export async function listarCidades(): Promise<string[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.rpc('cidades_dos_clientes')
  return ((data ?? []) as { cidade: string }[]).map((c) => c.cidade)
}

export async function listarEtiquetas(): Promise<EtiquetaLinha[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('etiquetas').select('id, nome').order('nome')
  return (data ?? []) as EtiquetaLinha[]
}

export type ImportacaoLinha = { id: string; nome: string; criada_em: string; qtd_criados: number; qtd_ignorados: number }

export async function listarImportacoes(): Promise<ImportacaoLinha[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('importacoes')
    .select('id, nome, criada_em, qtd_criados, qtd_ignorados')
    .order('criada_em', { ascending: false })
    .limit(50)
  return (data ?? []) as ImportacaoLinha[]
}
