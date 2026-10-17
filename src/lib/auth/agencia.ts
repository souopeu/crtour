import 'server-only'
import { cache } from 'react'
import { criarClienteServidor } from '@/lib/supabase/server'

// RLS lets a user see only their own membership row, so this is always the caller's.
export const getMembro = cache(async () => {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('membros').select('agencia_id, papel, nome').maybeSingle()
  return data as { agencia_id: string; papel: 'dono' | 'vendedor'; nome: string } | null
})

export async function getAgenciaId() {
  return (await getMembro())?.agencia_id ?? null
}
