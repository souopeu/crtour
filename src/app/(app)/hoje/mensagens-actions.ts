'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import type { EstadoForm } from '@/lib/forms'
import { configMensagensSchema, type TipoMensagem } from '@/lib/mensagens/mensagensPasseio'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar. Tente novamente em instantes.'
const TIPOS: TipoMensagem[] = ['confirmacao', 'lembrete', 'avaliacao']

export async function registrarMensagemPasseio(reservaId: string, tipo: TipoMensagem, mensagem: string): Promise<EstadoForm> {
  if (!z.uuid().safeParse(reservaId).success || !TIPOS.includes(tipo)) return { erro: ERRO }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('registrar_mensagem_passeio', { p_reserva: reservaId, p_tipo: tipo, p_mensagem: mensagem.slice(0, 1000) })
  if (error) {
    if (error.code === 'CR009') return { erro: 'Este cliente pediu para não receber mensagens.' }
    if (error.code === 'CR010') return { erro: 'Esta mensagem já foi registrada.' }
    if (error.code === 'CR006') return { erro: 'A reserva foi cancelada.' }
    console.error('registrarMensagemPasseio falhou', error.code)
    return { erro: ERRO }
  }
  revalidatePath('/hoje')
  return { ok: 'Envio registrado.' }
}

export async function salvarConfigMensagens(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = Object.fromEntries(['diasLembrete', 'diasAvaliacao', 'confirmacao', 'lembrete', 'avaliacao'].map((k) => [k, String(fd.get(k) ?? '')]))
  const r = configMensagensSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors as Record<string, string[]>, valores, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('agencias').update(r.data).eq('id', agenciaId).select('id')
  if (error) { console.error('salvarConfigMensagens falhou', error.code); return { erro: ERRO, valores, versao } }
  if (!data?.length) return { erro: 'Só o dono da agência muda as mensagens.', valores, versao }
  revalidatePath('/hoje')
  revalidatePath('/configuracoes')
  return { ok: 'Mensagens salvas.', valores, versao }
}
