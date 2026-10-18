import 'server-only'
import { listarMembros } from '@/lib/negociacoes/dados'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { StatusAtividade, TipoAtividade } from './atividades'
import { emBlocos } from '@/lib/consultas/emBlocos'

export type AtividadeLinha = {
  id: string; tipo: TipoAtividade; titulo: string; quando: string; status: StatusAtividade; feito_em: string | null
  responsavel_id: string | null; responsavel_nome: string | null; negociacao_id: string | null; negociacao_titulo: string | null
  criado_por: string | null; motivo: string | null
}

export async function listarAtividadesDoCliente(clienteId: string): Promise<AtividadeLinha[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('atividades')
    .select('id, tipo, titulo, quando, status, feito_em, responsavel_id, negociacao_id, criado_por, motivo')
    .eq('cliente_id', clienteId)
    .order('quando', { ascending: false })
    .limit(200)
  const linhas = (data ?? []) as Omit<AtividadeLinha, 'responsavel_nome' | 'negociacao_titulo'>[]
  if (linhas.length === 0) return []

  const ids = [...new Set(linhas.map((l) => l.negociacao_id).filter(Boolean) as string[])]
  const [membros, negociacoes] = await Promise.all([
    listarMembros(),
    emBlocos(ids, (b) => supabase.from('negociacoes').select('id, titulo').in('id', b)),
  ])
  const nomeMembro = new Map(membros.map((m) => [m.user_id, m.nome]))
  const tituloNegociacao = new Map(((negociacoes.data ?? []) as { id: string; titulo: string }[]).map((n) => [n.id, n.titulo]))
  return linhas.map((l) => ({
    ...l,
    responsavel_nome: l.responsavel_id ? (nomeMembro.get(l.responsavel_id) ?? null) : null,
    negociacao_titulo: l.negociacao_id ? (tituloNegociacao.get(l.negociacao_id) ?? null) : null,
  }))
}

export async function buscarUltimaInteracao(clienteId: string): Promise<string | null> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('clientes').select('ultima_interacao_em').eq('id', clienteId).maybeSingle()
  return (data as { ultima_interacao_em: string | null } | null)?.ultima_interacao_em ?? null
}
