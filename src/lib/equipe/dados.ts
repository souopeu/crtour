import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'

const membroSchema = z.object({ user_id: z.uuid(), nome: z.string(), papel: z.enum(['dono', 'vendedor']) })
const conviteSchema = z.object({ id: z.uuid(), email: z.string(), nome: z.string(), expira_em: z.string() })
export type MembroEquipe = z.infer<typeof membroSchema>
export type ConvitePendente = z.infer<typeof conviteSchema>

export async function listarEquipe(): Promise<MembroEquipe[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('membros').select('user_id, nome, papel').order('papel').order('nome')
  return z.array(membroSchema).catch([]).parse(data ?? [])
}

// RLS: only the owner sees invites.
export async function listarConvitesPendentes(): Promise<ConvitePendente[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('convites').select('id, email, nome, expira_em').is('aceito_em', null).order('criado_em', { ascending: false })
  return z.array(conviteSchema).catch([]).parse(data ?? [])
}
