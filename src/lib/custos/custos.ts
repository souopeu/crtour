import { z } from 'zod'
import { reaisParaCentavos } from '@/lib/passeios/dinheiro'

export type TipoFornecedor = 'transporte' | 'hospedagem' | 'guia' | 'ingresso' | 'alimentacao' | 'outro'
export const TIPOS_FORNECEDOR: { valor: TipoFornecedor; rotulo: string }[] = [
  { valor: 'transporte', rotulo: 'Transporte' }, { valor: 'hospedagem', rotulo: 'Hospedagem' }, { valor: 'guia', rotulo: 'Guia' },
  { valor: 'ingresso', rotulo: 'Ingresso' }, { valor: 'alimentacao', rotulo: 'Alimentação' }, { valor: 'outro', rotulo: 'Outro' },
]
export const rotuloDoTipo = (t: TipoFornecedor) => TIPOS_FORNECEDOR.find((x) => x.valor === t)?.rotulo ?? t

export const fornecedorSchema = z.object({
  nome: z.string().trim().min(1, 'Digite o nome do fornecedor.').max(120, 'O nome pode ter no máximo 120 caracteres.'),
  tipo: z.enum(TIPOS_FORNECEDOR.map((t) => t.valor) as [TipoFornecedor, ...TipoFornecedor[]], 'Escolha um tipo da lista.'),
  contato: z.string().trim().max(200, 'O contato pode ter no máximo 200 caracteres.').transform((v) => v || null),
})

const dataReal = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso

export const custoSchema = (hoje: string) => z.object({
  descricao: z.string().trim().min(1, 'Descreva o custo (ex.: ônibus, guia, hotel).').max(200, 'A descrição pode ter no máximo 200 caracteres.'),
  valor: z.string().transform((v) => reaisParaCentavos(v)).refine((v): v is number => v !== null && v > 0, 'Digite um valor maior que zero, ex.: 1.500,00.'),
  vencimento: z.string().trim().refine((v) => v === '' || dataReal(v), 'Escolha uma data válida ou deixe em branco.'),
  fornecedor: z.string().trim().refine((v) => v === '' || z.uuid().safeParse(v).success, 'Escolha o fornecedor na lista.'),
  pago: z.string(),
  dataPagamento: z.string().trim(),
}).superRefine((v, ctx) => {
  if (v.pago !== 'on') return
  if (!dataReal(v.dataPagamento)) ctx.addIssue({ code: 'custom', path: ['dataPagamento'], message: 'Informe a data do pagamento.' })
  else if (v.dataPagamento > hoje) ctx.addIssue({ code: 'custom', path: ['dataPagamento'], message: 'A data do pagamento não pode ser no futuro.' })
}).transform((v) => ({
  descricao: v.descricao, valor_centavos: v.valor, vencimento: v.vencimento || null,
  fornecedor_id: v.fornecedor || null, pago_em: v.pago === 'on' ? v.dataPagamento : null,
}))

// Margin of a departure (or of a month): what was sold minus what it costs.
export function margem(receita: number, custos: { valor_centavos: number; pago_em: string | null }[]) {
  const total = custos.reduce((s, c) => s + c.valor_centavos, 0)
  const pagos = custos.filter((c) => c.pago_em).reduce((s, c) => s + c.valor_centavos, 0)
  return { receita, custos: total, pagos, aPagar: total - pagos, margem: receita - total, percentual: receita > 0 ? (receita - total) / receita : null }
}
