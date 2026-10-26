import { z } from 'zod'
import { reaisParaCentavos } from '@/lib/passeios/dinheiro'

// R145: same order as the database enum `categoria_conta`.
export const CATEGORIAS_CONTA = ['aluguel', 'pessoal', 'marketing', 'sistemas', 'impostos', 'transporte', 'outros'] as const
export type CategoriaConta = (typeof CATEGORIAS_CONTA)[number]
const ROTULO: Record<CategoriaConta, string> = {
  aluguel: 'Aluguel', pessoal: 'Pessoal', marketing: 'Marketing', sistemas: 'Sistemas', impostos: 'Impostos', transporte: 'Transporte', outros: 'Outros',
}
export const rotuloCategoriaConta = (c: CategoriaConta) => ROTULO[c]
/** Category label of departure costs in the shared list (they are not agency bills). */
export const CATEGORIA_CUSTOS = 'Custos das saídas'

export const FORMAS_PAGO = ['pix', 'dinheiro', 'cartao', 'transferencia', 'outro'] as const
export const MODOS_CONTA = ['unica', 'parcelada', 'recorrente'] as const
export const MAX_PARCELAS = 60

const dia = z.iso.date('Escolha uma data válida.')

export const contaSchema = z
  .object({
    descricao: z.string().trim().min(1, 'Descreva a conta, ex.: Aluguel da loja.').max(200, 'A descrição pode ter no máximo 200 caracteres.'),
    categoria: z.enum(CATEGORIAS_CONTA, 'Escolha a categoria.'),
    valor: z.string().transform((v) => reaisParaCentavos(v)).refine((v): v is number => v !== null && v > 0, 'Digite um valor maior que zero, ex.: 2.500,00.'),
    vencimento: dia,
    fornecedor: z.string().trim().refine((v) => v === '' || z.uuid().safeParse(v).success, 'Escolha o fornecedor na lista.'),
    observacao: z.string().trim().max(1000, 'A observação pode ter no máximo 1.000 caracteres.'),
    modo: z.enum(MODOS_CONTA, 'Escolha se é única, parcelada ou mensal.'),
    parcelas: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.modo !== 'parcelada') return
    const n = Number(v.parcelas)
    if (!/^\d+$/.test(v.parcelas) || n < 2 || n > MAX_PARCELAS) {
      ctx.addIssue({ code: 'custom', path: ['parcelas'], message: `Informe de 2 a ${MAX_PARCELAS} parcelas.` })
    } else if (typeof v.valor === 'number' && v.valor < n) {
      ctx.addIssue({ code: 'custom', path: ['valor'], message: 'O valor é pequeno demais para tantas parcelas.' })
    }
  })
  .transform((v) => ({
    p_descricao: v.descricao, p_categoria: v.categoria, p_valor: v.valor as number, p_vencimento: v.vencimento,
    p_fornecedor: v.fornecedor || null, p_observacao: v.observacao || null,
    p_parcelas: v.modo === 'parcelada' ? Number(v.parcelas) : 1, p_recorrente: v.modo === 'recorrente',
  }))

export const pagarSchema = (hoje: string) => z
  .object({
    data: dia.refine((v) => v <= hoje, 'A data do pagamento não pode ser no futuro.'),
    forma: z.enum(FORMAS_PAGO, 'Escolha a forma de pagamento.'),
  })
  .transform((v) => ({ pago_em: v.data, forma_pago: v.forma }))

/** One line of the shared "A pagar" list: an agency bill or a departure cost. */
export type LinhaAPagar = {
  origem: 'conta' | 'custo'; id: string; descricao: string; categoria: string; valor: number
  vencimento: string | null; pagoEm: string | null; fornecedor: string | null; parcela: string | null; href: string
  fornecedorId?: string | null // R150: groups the payments to each supplier
  comprovanteId?: string | null
}

export type SituacaoAPagar = 'paga' | 'vencida' | 'proxima' | 'a_pagar'
export const DIAS_PROXIMOS = 7

const DIA_MS = 86_400_000
const diasAte = (data: string, hoje: string) => Math.round((Date.parse(`${data}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / DIA_MS)

export function situacaoAPagar(l: Pick<LinhaAPagar, 'pagoEm' | 'vencimento'>, hoje: string): SituacaoAPagar {
  if (l.pagoEm) return 'paga'
  if (!l.vencimento) return 'a_pagar'
  const d = diasAte(l.vencimento, hoje)
  if (d < 0) return 'vencida'
  return d <= DIAS_PROXIMOS ? 'proxima' : 'a_pagar'
}

export const FILTROS_A_PAGAR = ['a_pagar', 'vencidas', 'proximos7', 'pagas', 'todas'] as const
export type FiltroAPagar = (typeof FILTROS_A_PAGAR)[number]
export type FiltrosAPagar = { filtro: FiltroAPagar; categoria: string | null; de: string | null; ate: string | null }

const PASSA: Record<FiltroAPagar, (s: SituacaoAPagar) => boolean> = {
  a_pagar: (s) => s !== 'paga',
  vencidas: (s) => s === 'vencida',
  proximos7: (s) => s === 'proxima',
  pagas: (s) => s === 'paga',
  todas: () => true,
}

// R148: the default shows everything still to pay with no month limit, so a bill saved for next month never vanishes.
export function filtrarAPagar(linhas: readonly LinhaAPagar[], f: FiltrosAPagar, hoje: string): LinhaAPagar[] {
  return linhas
    .filter((l) => PASSA[f.filtro](situacaoAPagar(l, hoje)))
    .filter((l) => !f.categoria || l.categoria === f.categoria)
    .filter((l) => (!f.de && !f.ate) || (l.vencimento !== null && (!f.de || l.vencimento >= f.de) && (!f.ate || l.vencimento <= f.ate)))
    .sort((a, b) => (a.vencimento ?? '9999-12-31').localeCompare(b.vencimento ?? '9999-12-31') || a.descricao.localeCompare(b.descricao))
}

type Parametros = Record<string, string | string[] | undefined>
const um = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null)

export function lerFiltroAPagar(p: Parametros): FiltrosAPagar {
  const filtro = (FILTROS_A_PAGAR as readonly unknown[]).includes(p.filtro) ? (p.filtro as FiltroAPagar) : 'a_pagar'
  const data = (v: string | null) => (v && dia.safeParse(v).success ? v : null)
  const categoria = um(p.categoria)
  return { filtro, categoria: categoria && categoria.length <= 40 ? categoria : null, de: data(um(p.de)), ate: data(um(p.ate)) }
}

export function textoParcela(c: { parcela: number | null; total: number | null; recorrente: boolean }): string | null {
  if (c.total && c.parcela) return `Parcela ${c.parcela} de ${c.total}`
  return c.recorrente ? 'Mensal' : null
}
