import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import { NEGOCIACOES } from '@/lib/negociacoes/config'
import type { Etapa } from '@/lib/negociacoes/negociacoes'

export async function buscarMeta(mes: string): Promise<number | null> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('metas').select('valor_centavos').eq('mes', `${mes}-01`).maybeSingle()
  return (data as { valor_centavos: number } | null)?.valor_centavos ?? null
}

// For each lost deal, the stage it was in when it was lost (latest move to "perdido").
export async function etapasAntesDaPerda(): Promise<Map<string, Etapa>> {
  const supabase = await criarClienteServidor()
  // Newest first, so the cap drops the oldest events and the first one seen per deal is its latest loss.
  const { data } = await supabase.from('negociacao_eventos').select('negociacao_id, de').eq('para', 'perdido').order('em', { ascending: false }).limit(NEGOCIACOES.MAX_EVENTOS_PERDA)
  const antes = new Map<string, Etapa>()
  for (const e of (data ?? []) as { negociacao_id: string; de: Etapa | null }[]) if (!antes.has(e.negociacao_id)) antes.set(e.negociacao_id, e.de ?? 'interessado')
  return antes
}

export type AtividadesPessoa = {
  pessoa_id: string | null; nome: string; ligacao: number; whatsapp: number; email: number; reuniao: number; tarefa: number
  feitas: number; atrasadas: number; ganhas: number
}

/** Owner-only report (spec 18, R88/R89); null when the call fails or the caller is not the owner. */
export async function atividadesPorPessoa(mes: string): Promise<AtividadesPessoa[] | null> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('atividades_por_pessoa', { p_mes: mes })
  if (error) {
    console.error('atividadesPorPessoa falhou', error.code)
    return null
  }
  return (data ?? []) as AtividadesPessoa[]
}

const metasSchema = z.array(z.object({ mes: z.string(), valor_centavos: z.coerce.number() }))

// R97: the goals of several months at once (YYYY-MM → cents); months without a goal are missing.
export async function buscarMetas(meses: string[]): Promise<Map<string, number>> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('metas').select('mes, valor_centavos').in('mes', meses.map((m) => `${m}-01`))
  if (error) console.error('buscarMetas falhou', error.code)
  return new Map(metasSchema.catch([]).parse(data ?? []).map((x) => [x.mes.slice(0, 7), x.valor_centavos]))
}
