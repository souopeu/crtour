'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { lugarSchema } from '@/lib/embarque/embarque'
import type { EstadoForm } from '@/lib/forms'
import { mensagemDeErroReserva } from '@/lib/reservas/schema'
import { criarClienteServidor } from '@/lib/supabase/server'

const uuid = (v: string) => z.uuid().safeParse(v).success
const ESPERADOS = ['CR002', 'CR006', 'CR021', '22023']

function atualizar(saidaId: string) {
  revalidatePath(`/saidas/${saidaId}/embarque`)
  revalidatePath(`/saidas/${saidaId}`)
  revalidatePath('/operacao')
  revalidatePath('/reservas')
  revalidatePath('/hoje')
}

// R141: starting the boarding also moves the ready reservations to "em execução" (in the database).
export async function iniciarEmbarque(saidaId: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(saidaId)) return { erro: mensagemDeErroReserva(undefined), versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('iniciar_embarque', { p_saida: saidaId })
  if (error) {
    if (!ESPERADOS.includes(error.code ?? '')) console.error('iniciarEmbarque falhou', error.code)
    return { erro: mensagemDeErroReserva(error.code), versao }
  }
  atualizar(saidaId)
  return { ok: 'Embarque iniciado.', versao }
}

export async function marcarEmbarque(saidaId: string, reservaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const lugar = lugarSchema.safeParse({ passageiro: fd.get('passageiro') ?? '', vaga: fd.get('vaga') ?? '', embarcou: fd.get('embarcou') ?? '' })
  if (!lugar.success || !uuid(saidaId) || !uuid(reservaId)) return { erro: mensagemDeErroReserva(undefined), versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('marcar_embarque', {
    p_reserva: reservaId, p_passageiro: lugar.data.passageiro, p_vaga: lugar.data.vaga, p_embarcou: lugar.data.embarcou,
  })
  if (error) {
    if (!ESPERADOS.includes(error.code ?? '')) console.error('marcarEmbarque falhou', error.code)
    return { erro: mensagemDeErroReserva(error.code), versao }
  }
  atualizar(saidaId)
  return { ok: lugar.data.embarcou ? 'Embarcou.' : 'Desmarcado.', versao }
}
