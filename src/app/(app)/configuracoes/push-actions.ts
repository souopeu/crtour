'use server'

import { z } from 'zod'
import { getMembro } from '@/lib/auth/agencia'
import { criarClienteServidor } from '@/lib/supabase/server'

// What PushSubscription.toJSON() gives; validated here because it comes from the browser.
const inscricaoSchema = z.object({
  endpoint: z.url().startsWith('https://').max(1000),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
})

// R131: this device starts receiving notices (one row per device; registering again just keeps it).
export async function salvarInscricaoPush(entrada: unknown): Promise<{ ok: boolean }> {
  const r = inscricaoSchema.safeParse(entrada)
  const membro = await getMembro()
  if (!r.success || !membro) return { ok: false }
  const supabase = await criarClienteServidor()
  await supabase.from('inscricoes_push').delete().eq('endpoint', r.data.endpoint) // RLS: only if it was already mine
  const { error } = await supabase.from('inscricoes_push').insert({
    agencia_id: membro.agencia_id, endpoint: r.data.endpoint, p256dh: r.data.keys.p256dh, auth: r.data.keys.auth,
  })
  if (error) console.error('salvarInscricaoPush falhou', error.code)
  return { ok: !error }
}

export async function apagarInscricaoPush(endpoint: unknown): Promise<void> {
  const r = z.string().max(1000).safeParse(endpoint)
  if (!r.success) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('inscricoes_push').delete().eq('endpoint', r.data)
  if (error) console.error('apagarInscricaoPush falhou', error.code)
}
