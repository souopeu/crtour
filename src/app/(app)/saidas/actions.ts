'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { lerItens } from '@/lib/extras/extras'
import type { EstadoForm } from '@/lib/forms'
import { passageiroSchema } from '@/lib/passageiros/lista'
import { mensagemDeErroReserva, reservaSchema } from '@/lib/reservas/schema'
import { criarClienteServidor } from '@/lib/supabase/server'

const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

// The seat check and the insert happen inside one database function that locks the departure,
// so two sellers reserving at the same time can never exceed the capacity.
export async function criarReserva(saidaId: string, clienteId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const quantidades = [...fd.entries()].filter(([n]) => n.startsWith('extra:')).map(([n, v]) => [n, String(v)])
  const valores = { qtd: texto(fd, 'qtd'), valor: texto(fd, 'valor'), observacao: texto(fd, 'observacao'), ...Object.fromEntries(quantidades) }
  const r = reservaSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(saidaId) || !uuid(clienteId)) return { erro: mensagemDeErroReserva(undefined), valores, versao }
  const itens = lerItens(fd.entries())
  if (itens === null) return { campos: { extras: ['Informe a quantidade de cada extra (de 0 a 500).'] }, valores, versao }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('criar_reserva', {
    p_saida: saidaId,
    p_cliente: clienteId,
    p_qtd: r.data.qtd_pessoas,
    p_valor_total: r.data.valor_total_centavos,
    p_observacao: r.data.observacao,
    p_itens: itens.length ? itens : null,
  })
  if (error) {
    if (!['CR001', 'CR002', 'CR023'].includes(error.code ?? '')) console.error('criarReserva falhou', error.code)
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

export async function adicionarPassageiro(saidaId: string, reservaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { nome: texto(fd, 'nome'), whatsapp: texto(fd, 'whatsapp') }
  const r = passageiroSchema.safeParse({ ...valores, cadastrar: fd.get('cadastrar') ?? undefined })
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(saidaId) || !uuid(reservaId)) return { erro: mensagemDeErroReserva(undefined), valores, versao }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('adicionar_passageiro', {
    p_reserva: reservaId,
    p_nome: r.data.nome,
    p_whatsapp: r.data.whatsapp,
    p_criar_cliente: r.data.criar_cliente,
  })
  if (error) {
    if (!['CR005', 'CR006'].includes(error.code ?? '')) console.error('adicionarPassageiro falhou', error.code)
    return { erro: mensagemDeErroReserva(error.code), valores, versao }
  }
  revalidatePath(`/saidas/${saidaId}`, 'layout')
  if (r.data.criar_cliente) revalidatePath('/')
  return { versao } // clean form for the next companion
}

export async function removerPassageiro(saidaId: string, passageiroId: string): Promise<void> {
  if (!uuid(saidaId) || !uuid(passageiroId)) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('remover_passageiro', { p_passageiro: passageiroId })
  if (error) console.error('removerPassageiro falhou', error.code)
  revalidatePath(`/saidas/${saidaId}`, 'layout')
}
