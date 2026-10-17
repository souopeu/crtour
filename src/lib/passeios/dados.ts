import 'server-only'
import { z } from 'zod'
import { hojeNoBrasil } from '@/lib/formato'
import { criarClienteServidor } from '@/lib/supabase/server'

export type PasseioLinha = { id: string; nome: string; destino: string | null; descricao: string | null; arquivado: boolean }
export type SaidaLinha = { id: string; passeio_id: string; data: string; capacidade: number; preco_centavos: number; situacao: 'aberta' | 'encerrada' | 'cancelada' }

const COLUNAS_PASSEIO = 'id, nome, destino, descricao, arquivado'
const COLUNAS_SAIDA = 'id, passeio_id, data, capacidade, preco_centavos, situacao'
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
  const { data } = await supabase.from('saidas').select(COLUNAS_SAIDA).eq('passeio_id', passeioId).order('data')
  return (data ?? []) as SaidaLinha[]
}

export async function buscarSaida(id: string): Promise<(SaidaLinha & { passeio_nome: string }) | null> {
  if (!uuid(id)) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('saidas').select(COLUNAS_SAIDA).eq('id', id).maybeSingle()
  if (!data) return null
  const saida = data as SaidaLinha
  const passeio = await buscarPasseio(saida.passeio_id)
  return { ...saida, passeio_nome: passeio?.nome ?? '' }
}
