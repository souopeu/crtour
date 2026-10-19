import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
import { getUsuario } from '@/lib/auth/usuario'
import { criarClienteServidor } from '@/lib/supabase/server'

const membroSchema = z.object({
  user_id: z.uuid(), agencia_id: z.uuid(), papel: z.enum(['dono', 'vendedor']), nome: z.string(),
})
export type Membro = z.infer<typeof membroSchema>

// RLS shows every member of the agency, so filter by the caller explicitly. No membership (e.g. removed seller) = null.
export const getMembro = cache(async (): Promise<Membro | null> => {
  const usuario = await getUsuario()
  if (!usuario) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('membros').select('user_id, agencia_id, papel, nome').eq('user_id', usuario.id).maybeSingle()
  const r = membroSchema.safeParse(data)
  return r.success ? r.data : null
})

export async function getAgenciaId() {
  return (await getMembro())?.agencia_id ?? null
}

// RLS shows only the caller's agency. Shown at the top of the sidebar (R118).
export async function nomeDaAgencia(): Promise<string> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('agencias').select('nome').maybeSingle()
  return typeof data?.nome === 'string' ? data.nome : ''
}
