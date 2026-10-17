import 'server-only'
import { z } from 'zod'
import { hojeNoBrasil } from '@/lib/formato'
import { criarClienteServidor } from '@/lib/supabase/server'

export type PasseioLinha = { id: string; nome: string; destino: string | null; descricao: string | null; arquivado: boolean }
export type SaidaLinha = {
  id: string; passeio_id: string; data: string; capacidade: number; preco_centavos: number
  situacao: 'aberta' | 'encerrada' | 'cancelada'; reservadas: number; livres: number
}

const COLUNAS_PASSEIO = 'id, nome, destino, descricao, arquivado'
const COLUNAS_SAIDA = 'id, passeio_id, data, capacidade, preco_centavos, situacao, reservadas, livres'
const uuid = (v: string) => z.uuid().safeParse(v).success

export async function listarPasseios(arquivados: boolean): Promise<(PasseioLinha & { proximaSaida: string | null; totalSaidas: number })[]> {
  const supabase = await criarClienteServidor()
  const [passeios, saidas] = await Promise.all([
    supabase.from('passeios').select(COLUNAS_PASSEIO).eq('arquivado', arquivados).order('nome'),
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
  const { data } = await supabase.from('v_saidas_vagas').select(COLUNAS_SAIDA).eq('passeio_id', passeioId).order('data')
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

export type ReservaLinha = {
  id: string; cliente_id: string; cliente_nome: string; qtd_pessoas: number
  valor_total_centavos: number; situacao: 'ativa' | 'cancelada'; observacao: string | null
}

export async function listarReservas(saidaId: string): Promise<ReservaLinha[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('reservas')
    .select('id, cliente_id, qtd_pessoas, valor_total_centavos, situacao, observacao')
    .eq('saida_id', saidaId)
    .order('criada_em')
  const reservas = (data ?? []) as Omit<ReservaLinha, 'cliente_nome'>[]
  const ids = [...new Set(reservas.map((r) => r.cliente_id))]
  const nomes = new Map<string, string>()
  if (ids.length > 0) {
    const { data: clientes } = await supabase.from('clientes').select('id, nome').in('id', ids)
    for (const c of (clientes ?? []) as { id: string; nome: string }[]) nomes.set(c.id, c.nome)
  }
  return reservas.map((r) => ({ ...r, cliente_nome: nomes.get(r.cliente_id) ?? 'Cliente' }))
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
