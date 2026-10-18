'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'

export async function marcarAvisoLido(id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('avisos').update({ lido_em: new Date().toISOString() }).eq('id', id)
  if (error) console.error('marcarAvisoLido falhou', error.code)
  revalidatePath('/avisos', 'layout')
}

export async function marcarTodosLidos(): Promise<void> {
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('avisos').update({ lido_em: new Date().toISOString() }).is('lido_em', null)
  if (error) console.error('marcarTodosLidos falhou', error.code)
  revalidatePath('/avisos', 'layout')
}
