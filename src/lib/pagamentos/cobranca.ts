import { z } from 'zod'
import { formatarDataBr } from '@/lib/formato'
import { formatarReais, reaisParaCentavos } from '@/lib/passeios/dinheiro'
import { primeiroNome } from '@/lib/clientes/whatsappLink'

export const TIPOS_PAGAMENTO = ['sinal', 'parcela', 'saldo'] as const // 'estorno' only via the refund function
export const FORMAS_PAGAMENTO = ['pix', 'dinheiro', 'cartao', 'transferencia', 'outro'] as const
export const FILTROS_COBRANCA = ['todas', 'vencidas', 'proximos7', 'sem_vencimento'] as const
export type FiltroCobranca = (typeof FILTROS_COBRANCA)[number]
export type SituacaoCobranca = 'quitada' | 'vencida' | 'a_vencer' | 'sem_vencimento'

const DIA = 86_400_000
const emDias = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DIA)

// Calendar days from `hoje` to `data` (negative = in the past). Both are YYYY-MM-DD.
export function diasAte(data: string, hoje: string): number {
  return emDias(data) - emDias(hoje)
}

export function situacaoCobranca(saldoCentavos: number, vencimento: string | null, hoje: string): SituacaoCobranca {
  if (saldoCentavos <= 0) return 'quitada'
  if (!vencimento) return 'sem_vencimento'
  return diasAte(vencimento, hoje) < 0 ? 'vencida' : 'a_vencer'
}

export function passaFiltro(item: { saldo: number; vencimento: string | null }, filtro: FiltroCobranca, hoje: string): boolean {
  if (item.saldo <= 0) return false
  if (filtro === 'todas') return true
  if (filtro === 'sem_vencimento') return item.vencimento === null
  if (item.vencimento === null) return false
  const dias = diasAte(item.vencimento, hoje)
  return filtro === 'vencidas' ? dias < 0 : dias >= 0 && dias <= 7
}

export function mensagemCobranca(d: { nome: string; saldoCentavos: number; vencimento: string | null; passeio: string; dataSaida: string }): string {
  const nome = primeiroNome(d.nome)
  const venc = d.vencimento ? `, com vencimento em ${formatarDataBr(d.vencimento)}` : ''
  return `Olá${nome ? `, ${nome}` : ''}! Tudo bem? Passando para lembrar do saldo de ${formatarReais(d.saldoCentavos)} da sua viagem ${d.passeio} (saída em ${formatarDataBr(d.dataSaida)})${venc}. Qualquer dúvida, estou à disposição.`
}

const dataReal = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso

export function criarPagamentoSchema(hoje: string) {
  return z
    .object({
      valor: z.string().refine((v) => (reaisParaCentavos(v) ?? 0) > 0, 'Digite um valor maior que zero, ex.: 500,00.'),
      tipo: z.enum(TIPOS_PAGAMENTO, 'Escolha o tipo do pagamento.'),
      forma: z.enum(FORMAS_PAGAMENTO, 'Escolha a forma de pagamento.'),
      data: z
        .string()
        .trim()
        .refine(dataReal, 'Escolha uma data válida.')
        .refine((d) => d <= hoje, 'A data do pagamento não pode estar no futuro.'),
      observacao: z
        .string()
        .trim()
        .max(500, 'A observação pode ter no máximo 500 caracteres.')
        .transform((v) => (v === '' ? null : v)),
    })
    .transform((v) => ({ valor_centavos: reaisParaCentavos(v.valor) as number, tipo: v.tipo, forma: v.forma, data: v.data, observacao: v.observacao }))
}

export const vencimentoSchema = z.object({
  data: z
    .string()
    .trim()
    .refine((v) => v === '' || dataReal(v), 'Escolha uma data válida ou deixe em branco.')
    .transform((v) => (v === '' ? null : v)),
})

export const totalSchema = z
  .object({ valor: z.string().refine((v) => reaisParaCentavos(v) !== null, 'Digite o valor total, ex.: 2.700,00.') })
  .transform((v) => ({ valor_total_centavos: reaisParaCentavos(v.valor) as number }))
