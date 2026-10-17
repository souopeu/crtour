'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'

export async function aceitarSugestao(clienteId: string, sugestaoId: string): Promise<void> {
  if (!z.uuid().safeParse(clienteId).success || !z.uuid().safeParse(sugestaoId).success) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('aceitar_sugestao', { p_id: sugestaoId })
  if (error) console.error('aceitarSugestao falhou', error.code)
  revalidatePath(`/clientes/${clienteId}`)
}

export async function recusarSugestao(clienteId: string, sugestaoId: string): Promise<void> {
  if (!z.uuid().safeParse(clienteId).success || !z.uuid().safeParse(sugestaoId).success) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('sugestoes_cliente').delete().eq('id', sugestaoId)
  if (error) console.error('recusarSugestao falhou', error.code)
  revalidatePath(`/clientes/${clienteId}`)
}
