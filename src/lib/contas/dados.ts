import 'server-only'
import { z } from 'zod'
import { emBlocos } from '@/lib/consultas/emBlocos'
import { formatarDataBr } from '@/lib/formato'
import { criarClienteServidor } from '@/lib/supabase/server'
import { CATEGORIAS_CONTA, CATEGORIA_CUSTOS, FORMAS_PAGO, rotuloCategoriaConta, textoParcela, type LinhaAPagar } from './contas'

const ContaZ = z.object({
  id: z.uuid(), descricao: z.string(), categoria: z.enum(CATEGORIAS_CONTA), valor_centavos: z.number(), vencimento: z.string(),
  fornecedor_id: z.uuid().nullable(), observacao: z.string().nullable(), grupo_id: z.uuid().nullable(), parcela: z.number().nullable(),
  total_parcelas: z.number().nullable(), recorrente: z.boolean(), pago_em: z.string().nullable(), forma_pago: z.enum(FORMAS_PAGO).nullable(),
  comprovante_id: z.uuid().nullable(),
})
export type Conta = z.infer<typeof ContaZ>
const COLUNAS = 'id, descricao, categoria, valor_centavos, vencimento, fornecedor_id, observacao, grupo_id, parcela, total_parcelas, recorrente, pago_em, forma_pago, comprovante_id'

const CustoZ = z.object({
  id: z.uuid(), saida_id: z.uuid(), fornecedor_id: z.uuid().nullable(), descricao: z.string(), valor_centavos: z.number(),
  vencimento: z.string().nullable(), pago_em: z.string().nullable(), comprovante_id: z.uuid().nullable(),
})
const NomeZ = z.object({ id: z.uuid(), nome: z.string() })
const SaidaZ = z.object({ id: z.uuid(), data: z.string(), passeio_id: z.uuid() })

const LIMITE = 3000 // per kind; shortcut: an agency with more open bills than this would need paging

// R148: agency bills (owner only, by RLS) and departure costs in one list. Filtering happens in `filtrarAPagar`.
export async function listarAPagar(): Promise<LinhaAPagar[]> {
  const supabase = await criarClienteServidor()
  const [contasR, custosR] = await Promise.all([
    supabase.from('contas_pagar').select(COLUNAS).order('vencimento').limit(LIMITE),
    supabase.from('custos_saida').select('id, saida_id, fornecedor_id, descricao, valor_centavos, vencimento, pago_em, comprovante_id').limit(LIMITE),
  ])
  if (contasR.error) console.error('listarAPagar contas falhou', contasR.error.code)
  if (custosR.error) console.error('listarAPagar custos falhou', custosR.error.code)
  const contas = z.array(ContaZ).catch([]).parse(contasR.data ?? [])
  const custos = z.array(CustoZ).catch([]).parse(custosR.data ?? [])

  const saidasR = await emBlocos([...new Set(custos.map((c) => c.saida_id))], (b) => supabase.from('saidas').select('id, data, passeio_id').in('id', b))
  const saidas = z.array(SaidaZ).catch([]).parse(saidasR.data ?? [])
  const [passeiosR, fornR] = await Promise.all([
    emBlocos([...new Set(saidas.map((s) => s.passeio_id))], (b) => supabase.from('passeios').select('id, nome').in('id', b)),
    emBlocos([...new Set([...contas, ...custos].flatMap((x) => (x.fornecedor_id ? [x.fornecedor_id] : [])))], (b) => supabase.from('fornecedores').select('id, nome').in('id', b)),
  ])
  const passeio = new Map(z.array(NomeZ).catch([]).parse(passeiosR.data ?? []).map((p) => [p.id, p.nome]))
  const fornecedor = new Map(z.array(NomeZ).catch([]).parse(fornR.data ?? []).map((f) => [f.id, f.nome]))
  const saida = new Map(saidas.map((s) => [s.id, s]))

  return [
    ...contas.map((c): LinhaAPagar => ({
      origem: 'conta', id: c.id, descricao: c.descricao, categoria: rotuloCategoriaConta(c.categoria), valor: c.valor_centavos,
      vencimento: c.vencimento, pagoEm: c.pago_em, fornecedor: c.fornecedor_id ? (fornecedor.get(c.fornecedor_id) ?? null) : null,
      parcela: textoParcela({ parcela: c.parcela, total: c.total_parcelas, recorrente: c.recorrente }), href: `/financeiro/contas/${c.id}`,
      fornecedorId: c.fornecedor_id, comprovanteId: c.comprovante_id,
    })),
    ...custos.map((c): LinhaAPagar => {
      const s = saida.get(c.saida_id)
      return {
        origem: 'custo', id: c.id, descricao: s ? `${c.descricao} · ${passeio.get(s.passeio_id) ?? ''} ${formatarDataBr(s.data)}` : c.descricao,
        categoria: CATEGORIA_CUSTOS, valor: c.valor_centavos, vencimento: c.vencimento, pagoEm: c.pago_em,
        fornecedor: c.fornecedor_id ? (fornecedor.get(c.fornecedor_id) ?? null) : null, parcela: null, href: `/saidas/${c.saida_id}`,
        fornecedorId: c.fornecedor_id, comprovanteId: c.comprovante_id,
      }
    }),
  ]
}

export async function buscarConta(id: string): Promise<Conta | null> {
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('contas_pagar').select(COLUNAS).eq('id', id).maybeSingle()
  const r = ContaZ.safeParse(data)
  return r.success ? r.data : null
}
