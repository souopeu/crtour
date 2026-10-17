'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { EstadoForm } from '@/lib/forms'
import { mensagemDeErroReserva, reservaSchema } from '@/lib/reservas/schema'
import { criarClienteServidor } from '@/lib/supabase/server'

const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

// The seat check and the insert happen inside one database function that locks the departure,
// so two sellers reserving at the same time can never exceed the capacity.
export async function criarReserva(saidaId: string, clienteId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { qtd: texto(fd, 'qtd'), valor: texto(fd, 'valor'), observacao: texto(fd, 'observacao') }
  const r = reservaSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(saidaId) || !uuid(clienteId)) return { erro: mensagemDeErroReserva(undefined), valores, versao }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('criar_reserva', {
    p_saida: saidaId,
    p_cliente: clienteId,
    p_qtd: r.data.qtd_pessoas,
    p_valor_total: r.data.valor_total_centavos,
    p_observacao: r.data.observacao,
  })
  if (error) {
    if (!['CR001', 'CR002'].includes(error.code ?? '')) console.error('criarReserva falhou', error.code)
    return { erro: mensagemDeErroReserva(error.code), valores, versao }
  }
  revalidatePath('/passeios', 'layout')
  revalidatePath(`/saidas/${saidaId}`)
  redirect(`/saidas/${saidaId}?feito=1`)
}

export async function cancelarReserva(saidaId: string, reservaId: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(saidaId) || !uuid(reservaId)) return { erro: mensagemDeErroReserva(undefined), versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('cancelar_reserva', { p_reserva: reservaId })
  if (error) {
    console.error('cancelarReserva falhou', error.code)
    return { erro: mensagemDeErroReserva(error.code), versao }
  }
  revalidatePath('/passeios', 'layout')
  revalidatePath(`/saidas/${saidaId}`)
  return { ok: 'Reserva cancelada. As vagas voltaram para a saída.', versao }
}
