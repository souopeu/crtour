import { z } from 'zod'
import { FORMAS_PAGO, type LinhaAPagar } from '@/lib/contas/contas'
import { reaisParaCentavos } from '@/lib/passeios/dinheiro'

export type Acerto = { vendedorId: string; devido: number; pago: number; aAcertar: number }

// R149: per seller, due (commissions of the month) vs paid (sum of payments). Positive = still to pay; negative = paid more.
export function acertoPorVendedor(
  devidas: readonly { vendedorId: string | null; total: number }[], pagas: readonly { vendedor_id: string; valor_centavos: number }[],
): Acerto[] {
  const mapa = new Map<string, Acerto>()
  const de = (id: string) => mapa.get(id) ?? { vendedorId: id, devido: 0, pago: 0, aAcertar: 0 }
  for (const d of devidas) if (d.vendedorId) mapa.set(d.vendedorId, { ...de(d.vendedorId), devido: de(d.vendedorId).devido + d.total })
  for (const p of pagas) mapa.set(p.vendedor_id, { ...de(p.vendedor_id), pago: de(p.vendedor_id).pago + p.valor_centavos })
  return [...mapa.values()].map((a) => ({ ...a, aAcertar: a.devido - a.pago }))
}

const dia = (hoje: string) => z.iso.date('Escolha uma data válida.').refine((v) => v <= hoje, 'A data do pagamento não pode ser no futuro.')
const forma = z.enum(FORMAS_PAGO, 'Escolha a forma de pagamento.')

export const comissaoPagaSchema = (hoje: string) => z
  .object({
    vendedor: z.uuid('Escolha a pessoa.'),
    mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Escolha o mês.'),
    valor: z.string().transform((v) => reaisParaCentavos(v)).refine((v): v is number => v !== null && v > 0, 'Digite um valor maior que zero.'),
    data: dia(hoje),
    forma,
  })
  .transform((v) => ({ vendedor_id: v.vendedor, mes: `${v.mes}-01`, valor_centavos: v.valor as number, pago_em: v.data, forma_pago: v.forma }))

export type GrupoRepasse = { fornecedorId: string; fornecedor: string; total: number; linhas: LinhaAPagar[] }

// R150: what is still to pay, by supplier (bills and departure costs together), biggest total first.
export function agruparRepasses(linhas: readonly LinhaAPagar[]): GrupoRepasse[] {
  const mapa = new Map<string, GrupoRepasse>()
  for (const l of linhas) {
    if (l.pagoEm || !l.fornecedorId) continue
    const g = mapa.get(l.fornecedorId) ?? { fornecedorId: l.fornecedorId, fornecedor: l.fornecedor ?? 'Fornecedor', total: 0, linhas: [] }
    mapa.set(l.fornecedorId, { ...g, total: g.total + l.valor, linhas: [...g.linhas, l] })
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total || a.fornecedor.localeCompare(b.fornecedor))
}

const item = z.string().regex(/^(conta|custo):/).transform((v) => v.split(':') as [string, string]).refine(([, id]) => z.uuid().safeParse(id).success)

// Checked lines arrive as item=conta:<id> / item=custo:<id>.
export const loteSchema = (hoje: string) => z
  .object({ itens: z.array(item).min(1, 'Marque pelo menos um lançamento.'), data: dia(hoje), forma })
  .transform((v) => ({
    p_contas: v.itens.filter(([o]) => o === 'conta').map(([, id]) => id),
    p_custos: v.itens.filter(([o]) => o === 'custo').map(([, id]) => id),
    p_data: v.data, p_forma: v.forma,
  }))

export const lerLote = (fd: FormData, hoje: string) =>
  loteSchema(hoje).safeParse({ itens: fd.getAll('item').map(String), data: String(fd.get('data') ?? ''), forma: String(fd.get('forma') ?? '') })
