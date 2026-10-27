import 'server-only'
import { z } from 'zod'
import { criarClienteServidor } from '@/lib/supabase/server'
import { dadosVoucherSchema } from './voucher'

const linhaSchema = z.object({
  id: z.uuid(), codigo: z.string(), criado_em: z.string(), enviado_em: z.string().nullable(), revogado_em: z.string().nullable(), dados: dadosVoucherSchema,
})
export type VoucherLinha = z.infer<typeof linhaSchema>

export async function listarVouchers(reservaId: string): Promise<VoucherLinha[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('vouchers').select('id, codigo, criado_em, enviado_em, revogado_em, dados')
    .eq('reserva_id', reservaId).order('criado_em', { ascending: false }).limit(50)
  if (error) console.error('listarVouchers falhou', error.code)
  return z.array(linhaSchema).catch([]).parse(data ?? [])
}

const contextoSchema = z.object({
  agencia: z.object({ nome: z.string() }),
  reserva: z.object({ qtd_pessoas: z.number().int(), agencia_id: z.uuid() }),
  cliente: z.object({ nome: z.string(), whatsapp: z.string().nullable(), consentimento_whatsapp: z.string() }),
  saida: z.object({ data: z.string(), passeio: z.object({ nome: z.string(), destino: z.string().nullable(), inclui: z.string().nullable(), passeio_dias: z.array(z.object({ dia: z.number(), titulo: z.string(), descricao: z.string().nullable() })).default([]), dias: z.number().default(1) }) }),
  passageiros: z.array(z.object({ nome: z.string() })),
})
export type ContextoVoucher = z.infer<typeof contextoSchema>

// What a new voucher copies from the reservation: agency, client, departure and tour, and the named travellers.
export async function contextoDaReserva(reservaId: string): Promise<ContextoVoucher | null> {
  const supabase = await criarClienteServidor()
  const { data: reserva } = await supabase.from('reservas').select('qtd_pessoas, agencia_id, cliente_id, saida_id').eq('id', reservaId).maybeSingle()
  if (!reserva) return null
  const [agencia, cliente, saida, passageiros] = await Promise.all([
    supabase.from('agencias').select('nome').eq('id', reserva.agencia_id).maybeSingle(),
    supabase.from('clientes').select('nome, whatsapp, consentimento_whatsapp').eq('id', reserva.cliente_id).maybeSingle(),
    supabase.from('saidas').select('data, passeio:passeios(nome, destino, inclui, dias, passeio_dias(dia, titulo, descricao))').eq('id', reserva.saida_id).maybeSingle(),
    supabase.from('passageiros').select('nome').eq('reserva_id', reservaId).order('criado_em'),
  ])
  const r = contextoSchema.safeParse({ agencia: agencia.data, reserva, cliente: cliente.data, saida: saida.data, passageiros: passageiros.data ?? [] })
  if (!r.success) console.error('contextoDaReserva falhou', 'formato')
  return r.success ? r.data : null
}
