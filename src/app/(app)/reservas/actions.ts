'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { EstadoForm } from '@/lib/forms'
import { hojeNoBrasil } from '@/lib/formato'
import { criarPagamentoSchema, totalSchema, vencimentoSchema } from '@/lib/pagamentos/cobranca'
import { mensagemDeErroReserva } from '@/lib/reservas/schema'
import { rotuloDoStatus, statusSchema } from '@/lib/reservas/status'
import { criarClienteServidor } from '@/lib/supabase/server'

const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')
const ESPERADOS = ['CR001', 'CR002', 'CR006', 'CR007', 'CR008', 'CR014', 'CR018', '22008', '22023', '23514', '22003']

function atualizarTelas(reservaId: string) {
  revalidatePath(`/reservas/${reservaId}`)
  revalidatePath('/reservas')
  revalidatePath('/cobrancas')
  revalidatePath('/saidas', 'layout')
}

// R136: forward is free; going back only with `voltar=1` (the screen asked first), checked again by the database.
export async function definirStatusOperacional(reservaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const status = statusSchema.safeParse(fd.get('status'))
  if (!status.success || !uuid(reservaId)) return { erro: mensagemDeErroReserva(undefined), versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('definir_status_operacional', { p_reserva: reservaId, p_status: status.data, p_voltar: fd.get('voltar') === '1' })
  if (error) return falha(error)
  atualizarTelas(reservaId)
  revalidatePath('/hoje')
  revalidatePath('/calendario')
  return { ok: `Status: ${rotuloDoStatus(status.data)}.`, versao }
}

// R140: move to another departure of the same tour; the database locks both and checks the seats.
export async function moverReserva(reservaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const destino = String(fd.get('saida') ?? '')
  if (!uuid(reservaId)) return { erro: mensagemDeErroReserva(undefined), versao }
  if (!uuid(destino)) return { erro: 'Escolha a saída de destino.', versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('mover_reserva_saida', { p_reserva: reservaId, p_saida: destino })
  if (error) return falha(error)
  atualizarTelas(reservaId)
  revalidatePath('/operacao')
  revalidatePath('/calendario')
  revalidatePath('/passeios', 'layout')
  return { ok: 'Reserva movida.', versao }
}

function falha(error: { code?: string }, valores?: Record<string, string>): EstadoForm {
  if (!ESPERADOS.includes(error.code ?? '')) console.error('reserva/pagamento falhou', error.code)
  return { erro: mensagemDeErroReserva(error.code), valores, versao: crypto.randomUUID() }
}

export async function registrarPagamento(reservaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { valor: texto(fd, 'valor'), tipo: texto(fd, 'tipo'), forma: texto(fd, 'forma'), data: texto(fd, 'data'), observacao: texto(fd, 'observacao') }
  const r = criarPagamentoSchema(hojeNoBrasil()).safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(reservaId)) return { erro: mensagemDeErroReserva(undefined), valores, versao }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('registrar_pagamento', {
    p_reserva: reservaId, p_valor: r.data.valor_centavos, p_tipo: r.data.tipo, p_forma: r.data.forma,
    p_data: r.data.data, p_observacao: r.data.observacao,
  })
  if (error) return falha(error, valores)
  atualizarTelas(reservaId)
  return { ok: 'Pagamento registrado.', versao } // clean form for the next one
}

export async function estornarPagamento(reservaId: string, pagamentoId: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(reservaId) || !uuid(pagamentoId)) return { erro: mensagemDeErroReserva(undefined), versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('estornar_pagamento', { p_pagamento: pagamentoId })
  if (error) return falha(error)
  atualizarTelas(reservaId)
  return { ok: 'Pagamento estornado. O valor foi descontado do total pago.', versao }
}

export async function definirVencimento(reservaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { data: texto(fd, 'data') }
  const r = vencimentoSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(reservaId)) return { erro: mensagemDeErroReserva(undefined), valores, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('definir_vencimento_saldo', { p_reserva: reservaId, p_data: r.data.data })
  if (error) return falha(error, valores)
  atualizarTelas(reservaId)
  return { ok: r.data.data ? 'Vencimento salvo.' : 'Vencimento removido.', valores, versao }
}

export async function alterarValorTotal(reservaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { valor: texto(fd, 'valor') }
  const r = totalSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(reservaId)) return { erro: mensagemDeErroReserva(undefined), valores, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('alterar_valor_total', { p_reserva: reservaId, p_valor: r.data.valor_total_centavos })
  if (error) return falha(error, valores)
  atualizarTelas(reservaId)
  return { ok: 'Valor total atualizado.', valores, versao }
}
