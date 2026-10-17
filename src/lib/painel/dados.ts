import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { Etapa } from '@/lib/negociacoes/negociacoes'

export async function buscarMeta(mes: string): Promise<number | null> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('metas').select('valor_centavos').eq('mes', `${mes}-01`).maybeSingle()
  return (data as { valor_centavos: number } | null)?.valor_centavos ?? null
}

// For each lost deal, the stage it was in when it was lost (latest move to "perdido").
export async function etapasAntesDaPerda(): Promise<Map<string, Etapa>> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('negociacao_eventos').select('negociacao_id, de').eq('para', 'perdido').order('em').limit(5000)
  return new Map(((data ?? []) as { negociacao_id: string; de: Etapa | null }[]).map((e) => [e.negociacao_id, e.de ?? 'interessado']))
}
