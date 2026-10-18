'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível concluir. Tente novamente em instantes.'
const SEM_ACESSO = 'Esta conversa não está mais com você. Atualize a página.'
const uuid = (v: unknown) => z.uuid().safeParse(v).success

async function chamar(funcao: string, args: Record<string, string>, ok: string): Promise<EstadoForm> {
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc(funcao, args)
  if (error?.code === 'P0002') return { erro: SEM_ACESSO }
  if (error?.code === '22023') return { erro: 'Escolha uma pessoa da agência.' }
  if (error) { console.error(`${funcao} falhou`, error.code); return { erro: ERRO } }
  revalidatePath('/atendimento')
  return { ok }
}

// R104: take a conversation, hand it to someone, archive it. The database checks who may do it.
export async function assumirConversa(id: string): Promise<EstadoForm> {
  if (!uuid(id)) return { erro: ERRO }
  return chamar('conversa_assumir', { p_conversa: id }, 'Agora o atendimento é seu.')
}

export async function transferirConversa(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const para = fd.get('para')
  if (!uuid(id)) return { erro: ERRO }
  if (!uuid(para)) return { erro: 'Escolha para quem passar o atendimento.' }
  const nome = String(fd.get('para_nome') ?? '').slice(0, 100)
  return chamar('conversa_transferir', { p_conversa: id, p_para: String(para) }, nome ? `Atendimento passado para ${nome}.` : 'Atendimento passado.')
}

export async function arquivarConversa(id: string): Promise<EstadoForm> {
  if (!uuid(id)) return { erro: ERRO }
  return chamar('conversa_arquivar', { p_conversa: id }, 'Conversa arquivada. Ela volta sozinha se o cliente escrever de novo.')
}

// Opening a conversation clears its unread count (called once from the screen, not during rendering).
export async function marcarConversaLida(id: string): Promise<void> {
  if (!uuid(id)) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('conversa_marcar_lida', { p_conversa: id })
  if (error && error.code !== 'P0002') console.error('conversa_marcar_lida falhou', error.code)
}
