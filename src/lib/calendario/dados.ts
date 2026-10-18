import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { ItemCalendario } from './calendario'

/** Items between two dates (at most 6 weeks); null when the database call fails. */
export async function listarCalendario(inicio: string, fim: string): Promise<ItemCalendario[] | null> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('calendario_mes', { p_inicio: inicio, p_fim: fim })
  if (error) {
    console.error('listarCalendario falhou', error.code)
    return null
  }
  return (data ?? []) as ItemCalendario[]
}
