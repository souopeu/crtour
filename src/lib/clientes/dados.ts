import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import { POR_PAGINA, type Filtros } from './filtros'
import type { LinhaCliente } from './formulario'
import type { Viagem } from './viagens'

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

// Trips of a client: as the responsible (with money) and as a registered companion.
export async function listarViagensDoCliente(clienteId: string): Promise<Viagem[]> {
  const supabase = await criarClienteServidor()
  const [responsavel, acompanhante] = await Promise.all([
    supabase
      .from('v_reservas_saldo')
      .select('id, saida_id, qtd_pessoas, situacao, valor_total_centavos, pago_centavos, saldo_centavos')
      .eq('cliente_id', clienteId),
    supabase.from('passageiros').select('reserva_id').eq('cliente_id', clienteId),
  ])
  const proprias = (responsavel.data ?? []) as { id: string; saida_id: string; qtd_pessoas: number; situacao: 'ativa' | 'cancelada'; valor_total_centavos: number; pago_centavos: number; saldo_centavos: number }[]
  const idsProprios = new Set(proprias.map((r) => r.id))
  const comoAcompanhante = [...new Set(((acompanhante.data ?? []) as { reserva_id: string }[]).map((p) => p.reserva_id))].filter((id) => !idsProprios.has(id))

  let outras: { id: string; saida_id: string; qtd_pessoas: number; situacao: 'ativa' | 'cancelada' }[] = []
  if (comoAcompanhante.length > 0) {
    const { data } = await supabase.from('v_reservas_saldo').select('id, saida_id, qtd_pessoas, situacao').in('id', comoAcompanhante)
    outras = (data ?? []) as typeof outras
  }
  const todas = [...proprias, ...outras]
  if (todas.length === 0) return []

  const { data: saidas } = await supabase.from('saidas').select('id, data, passeio_id').in('id', [...new Set(todas.map((r) => r.saida_id))])
  const saidasLinhas = (saidas ?? []) as { id: string; data: string; passeio_id: string }[]
  const { data: passeios } = await supabase.from('passeios').select('id, nome').in('id', [...new Set(saidasLinhas.map((s) => s.passeio_id))])
  const nomePasseio = new Map(((passeios ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]))
  const porSaida = new Map(saidasLinhas.map((s) => [s.id, s]))

  const base = (r: { id: string; saida_id: string; qtd_pessoas: number; situacao: 'ativa' | 'cancelada' }) => {
    const s = porSaida.get(r.saida_id)
    return { reservaId: r.id, passeio: s ? (nomePasseio.get(s.passeio_id) ?? '') : '', saidaData: s?.data ?? '', qtd: r.qtd_pessoas, situacao: r.situacao }
  }
  return [
    ...proprias.map((r): Viagem => ({ ...base(r), total: r.valor_total_centavos, pago: r.pago_centavos, saldo: r.saldo_centavos, papel: 'Responsável' })),
    ...outras.map((r): Viagem => ({ ...base(r), total: 0, pago: 0, saldo: 0, papel: 'Acompanhante' })),
  ].filter((v) => v.saidaData !== '')
}
