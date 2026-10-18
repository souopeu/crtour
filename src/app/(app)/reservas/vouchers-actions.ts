'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { EstadoForm } from '@/lib/forms'
import { contextoDaReserva } from '@/lib/vouchers/dados'
import { lerFormVoucher, listaDePassageiros, montarDados } from '@/lib/vouchers/voucher'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar. Tente novamente em instantes.'
const SEM_QUITACAO = 'O voucher só sai depois que a reserva estiver quitada.'
const uuid = (v: string) => z.uuid().safeParse(v).success

// R76: the values typed now are frozen in the voucher; later edits never change it. The database refuses a reservation that is not fully paid.
export async function criarVoucher(reservaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = Object.fromEntries(['encontro', 'horario', 'observacoes'].map((k) => [k, String(fd.get(k) ?? '')]))
  const r = lerFormVoucher(fd)
  if (!r.ok) return { campos: Object.fromEntries(Object.entries(r.campos).map(([k, v]) => [k, [v]])), valores, versao }
  if (!uuid(reservaId)) return { erro: ERRO, valores, versao }
  const c = await contextoDaReserva(reservaId)
  if (!c) return { erro: ERRO, valores, versao }
  const [responsavel, ...acompanhantes] = [c.cliente.nome, ...c.passageiros.map((p) => p.nome)]
  const dados = montarDados(r.dados, {
    agencia: c.agencia.nome, cliente: c.cliente.nome, passeio: c.saida.passeio.nome, destino: c.saida.passeio.destino, saida: c.saida.data,
    inclui: c.saida.passeio.inclui, pessoas: c.reserva.qtd_pessoas, passageiros: listaDePassageiros(responsavel, acompanhantes, c.reserva.qtd_pessoas),
  })
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('vouchers').insert({ agencia_id: c.reserva.agencia_id, reserva_id: reservaId, dados })
  if (error) {
    if (error.code !== '42501') console.error('criarVoucher falhou', error.code)
    return { erro: error.code === '42501' ? SEM_QUITACAO : ERRO, valores, versao }
  }
  revalidatePath(`/reservas/${reservaId}`)
  return { ok: 'Voucher criado.', versao }
}

// After opening WhatsApp: logs the send on the client's timeline.
export async function registrarEnvioVoucher(voucherId: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(voucherId)) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { data: v } = await supabase.from('vouchers').select('id, agencia_id, reserva_id, dados').eq('id', voucherId).is('revogado_em', null).maybeSingle()
  const { data: reserva } = v ? await supabase.from('reservas').select('cliente_id').eq('id', v.reserva_id).maybeSingle() : { data: null }
  if (!v || !reserva) return { erro: 'Voucher não encontrado.', versao }
  const passeio = (v.dados as { passeio?: string }).passeio ?? ''
  const [atividade, enviado] = await Promise.all([
    supabase.from('atividades').insert({
      agencia_id: v.agencia_id, cliente_id: reserva.cliente_id, tipo: 'whatsapp',
      titulo: `Voucher enviado: ${passeio}`.slice(0, 200), quando: new Date().toISOString(), status: 'feito',
    }),
    supabase.from('vouchers').update({ enviado_em: new Date().toISOString() }).eq('id', v.id),
  ])
  if (atividade.error || enviado.error) { console.error('registrarEnvioVoucher falhou', (atividade.error ?? enviado.error)?.code); return { erro: ERRO, versao } }
  revalidatePath(`/reservas/${v.reserva_id}`)
  revalidatePath(`/clientes/${reserva.cliente_id}`)
  return { ok: 'Envio registrado.', versao }
}

export async function revogarVoucher(voucherId: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(voucherId)) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('vouchers').update({ revogado_em: new Date().toISOString() }).eq('id', voucherId).is('revogado_em', null).select('reserva_id')
  if (error || !data?.length) { console.error('revogarVoucher falhou', error?.code); return { erro: ERRO, versao } }
  revalidatePath(`/reservas/${data[0].reserva_id}`)
  return { ok: 'Voucher revogado.', versao }
}
