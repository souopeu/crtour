import { z } from 'zod'
import { primeiroNome } from '@/lib/clientes/whatsappLink'
import { NOME_A_INFORMAR } from '@/lib/passageiros/lista'

export type FormVoucher = { encontro: string | null; horario: string | null; observacoes: string | null }
export type ResultadoForm = { ok: true; dados: FormVoucher } | { ok: false; campos: Partial<Record<keyof FormVoucher, string>> }

const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '').trim()
const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/

// What the person types when issuing a voucher; all optional.
export function lerFormVoucher(fd: FormData): ResultadoForm {
  const campos: Partial<Record<keyof FormVoucher, string>> = {}
  const encontro = texto(fd, 'encontro')
  const horario = texto(fd, 'horario')
  const observacoes = texto(fd, 'observacoes')
  if (encontro.length > 200) campos.encontro = 'Use no máximo 200 caracteres.'
  if (horario !== '' && !HORARIO.test(horario)) campos.horario = 'Digite o horário como 07:30.'
  if (observacoes.length > 1000) campos.observacoes = 'Use no máximo 1000 caracteres.'
  if (Object.keys(campos).length > 0) return { ok: false, campos }
  return { ok: true, dados: { encontro: encontro || null, horario: horario || null, observacoes: observacoes || null } }
}

export const dadosVoucherSchema = z.object({
  agencia: z.string(), cliente: z.string(), passeio: z.string(), destino: z.string().nullable(), saida: z.string(),
  inclui: z.string().nullable(), pessoas: z.number().int(), passageiros: z.array(z.string()),
  encontro: z.string().nullable(), horario: z.string().nullable(), observacoes: z.string().nullable(),
  extras: z.array(z.string()).default([]), // R158: "2 × Almoço"; vouchers issued before extras have none
})
export type DadosVoucher = z.infer<typeof dadosVoucherSchema>
type Contexto = Pick<DadosVoucher, 'agencia' | 'cliente' | 'passeio' | 'destino' | 'saida' | 'inclui' | 'pessoas' | 'passageiros'> & { extras?: string[] }

// The frozen snapshot: later edits to the tour or the reservation never change an issued voucher.
export function montarDados(f: FormVoucher, c: Contexto): DadosVoucher {
  return { extras: [], ...c, ...f }
}

// A voucher exists only for an active reservation that is fully paid (the database enforces the same rule).
export function reservaQuitada(r: { situacao: string; pago_centavos: number; saldo_centavos: number }): boolean {
  return r.situacao === 'ativa' && r.pago_centavos > 0 && r.saldo_centavos <= 0
}

// One name per place: the responsible first, then named companions, then places still without a name.
export function listaDePassageiros(responsavel: string, acompanhantes: string[], pessoas: number): string[] {
  const nomes = [responsavel, ...acompanhantes]
  while (nomes.length < pessoas) nomes.push(NOME_A_INFORMAR)
  return nomes.slice(0, pessoas)
}

export function mensagemVoucher(nome: string, link: string, passeio: string): string {
  const primeiro = primeiroNome(nome)
  return `Olá${primeiro ? `, ${primeiro}` : ''}! Segue o voucher do passeio ${passeio}: ${link}`
}
