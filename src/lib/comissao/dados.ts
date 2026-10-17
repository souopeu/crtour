import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { Regra } from './comissao'

const num = z.union([z.number(), z.string()]).transform(Number) // numeric columns may come as text
const membroSchema = z.object({ user_id: z.uuid(), nome: z.string(), papel: z.enum(['dono', 'vendedor']), comissao_percentual: num })
const passeioSchema = z.object({ id: z.uuid(), nome: z.string(), comissao_percentual: num, comissao_por_pessoa_centavos: z.number() })
const linhaSchema = z.object({
  reserva_id: z.uuid(), vendedor_id: z.uuid().nullable(), cliente_id: z.uuid(), saida_id: z.uuid(), qtd_pessoas: z.number(),
  valor_total_centavos: z.number(), quitada_em: z.string(), comissao_centavos: z.number(),
})
export type LinhaComissao = z.infer<typeof linhaSchema> & { cliente_nome: string; passeio_nome: string; saida_data: string }

export async function buscarConfigComissao() {
  const supabase = await criarClienteServidor()
  const [agencia, membros, passeios] = await Promise.all([
    supabase.from('agencias').select('regra_comissao').maybeSingle(),
    supabase.from('membros').select('user_id, nome, papel, comissao_percentual').order('nome'),
    supabase.from('passeios').select('id, nome, comissao_percentual, comissao_por_pessoa_centavos').eq('arquivado', false).order('nome'),
  ])
  return {
    regra: ((agencia.data as { regra_comissao: Regra | null } | null)?.regra_comissao ?? null),
    membros: z.array(membroSchema).catch([]).parse(membros.data ?? []),
    passeios: z.array(passeioSchema).catch([]).parse(passeios.data ?? []),
  }
}

export async function listarComissoes(mes: string): Promise<LinhaComissao[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('comissoes_do_mes', { p_mes: `${mes}-01` })
  if (error) console.error('comissoes_do_mes falhou', error.code)
  const linhas = z.array(linhaSchema).catch([]).parse(data ?? [])
  if (linhas.length === 0) return []
  const [clientes, saidas] = await Promise.all([
    supabase.from('clientes').select('id, nome').in('id', [...new Set(linhas.map((l) => l.cliente_id))]),
    supabase.from('saidas').select('id, data, passeio_id').in('id', [...new Set(linhas.map((l) => l.saida_id))]),
  ])
  const s = z.array(z.object({ id: z.uuid(), data: z.string(), passeio_id: z.uuid() })).catch([]).parse(saidas.data ?? [])
  const passeios = await supabase.from('passeios').select('id, nome').in('id', [...new Set(s.map((x) => x.passeio_id))])
  const nomeCliente = new Map(z.array(z.object({ id: z.uuid(), nome: z.string() })).catch([]).parse(clientes.data ?? []).map((c) => [c.id, c.nome]))
  const nomePasseio = new Map(z.array(z.object({ id: z.uuid(), nome: z.string() })).catch([]).parse(passeios.data ?? []).map((p) => [p.id, p.nome]))
  const saida = new Map(s.map((x) => [x.id, x]))
  return linhas.map((l) => ({
    ...l,
    cliente_nome: nomeCliente.get(l.cliente_id) ?? 'Cliente',
    passeio_nome: nomePasseio.get(saida.get(l.saida_id)?.passeio_id ?? '') ?? 'Passeio',
    saida_data: saida.get(l.saida_id)?.data ?? '',
  }))
}

export async function buscarVendedorDaReserva(reservaId: string): Promise<string | null> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('reservas').select('vendedor_id').eq('id', reservaId).maybeSingle()
  return (data as { vendedor_id: string | null } | null)?.vendedor_id ?? null
}
