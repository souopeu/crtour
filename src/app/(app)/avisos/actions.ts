'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import { textoDoAviso } from '@/lib/avisos/avisos'
import { contarAvisosNaoLidos, listarAvisos } from '@/lib/negociacoes/dados'

const SINO_MAXIMO = 10

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

export type ItemSino = { id: string; titulo: string; detalhe: string; href: string | null; lido: boolean }

// R130: what the bell shows; called on open and every minute while the screen is open.
export async function lerSino(): Promise<{ naoLidos: number; itens: ItemSino[] }> {
  const [naoLidos, avisos] = await Promise.all([contarAvisosNaoLidos(), listarAvisos(SINO_MAXIMO)])
  return { naoLidos, itens: avisos.map((a) => ({ id: a.id, ...textoDoAviso(a), lido: a.lido_em !== null })) }
}
