'use server'

import { termoValido, type ResultadoBusca } from '@/lib/busca/busca'
import { criarClienteServidor } from '@/lib/supabase/server'

/** Global search (R76, R77). Returns null when the database call fails, [] for a too-short term. */
export async function buscarGlobal(termo: unknown): Promise<ResultadoBusca[] | null> {
  const t = typeof termo === 'string' ? termoValido(termo) : null
  if (!t) return []
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('busca_global', { p_busca: t })
  if (error) {
    console.error('buscarGlobal falhou', error.code)
    return null
  }
  return (data ?? []) as ResultadoBusca[]
}
