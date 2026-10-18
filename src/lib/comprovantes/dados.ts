import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'

/** Payments (of the given ids) that have a receipt attached; RLS keeps it inside the agency. */
export async function pagamentosComComprovante(pagamentoIds: string[]): Promise<Set<string>> {
  if (pagamentoIds.length === 0) return new Set()
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('comprovantes').select('pagamento_id').in('pagamento_id', pagamentoIds)
  if (error) console.error('pagamentosComComprovante falhou', error.code)
  return new Set((data ?? []).map((c) => c.pagamento_id as string))
}
