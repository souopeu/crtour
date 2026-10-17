import 'server-only'
import { cache } from 'react'
import { criarClienteServidor } from '@/lib/supabase/server'

// RLS lets a user see only their own membership, so this returns the caller's agency.
export const getAgenciaId = cache(async () => {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('membros').select('agencia_id').maybeSingle()
  return data?.agencia_id ?? null
})
