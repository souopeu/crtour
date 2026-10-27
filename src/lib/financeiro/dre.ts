import { situacaoAPagar, type LinhaAPagar } from '@/lib/contas/contas'
import { paraCsv } from '@/lib/exportacao/csv'
import { formatarDataBr } from '@/lib/formato'
import { rotuloDoMes } from '@/lib/painel/painel'
import { centavosParaCampo } from '@/lib/passeios/dinheiro'
import type { Movimento } from './conferencia'

export const BASES_DRE = ['caixa', 'competencia'] as const
export type BaseDre = (typeof BASES_DRE)[number]
export type PeriodoDre = { de: string; ate: string; base: BaseDre }
// One entry behind a DRE line. Revenue may be negative (a refund, on the cash basis).
export type ItemDre = { grupo: 'receita' | 'custo' | 'comissao' | 'despesa'; tarifa?: 'balcao' | 'b2b'; categoria?: string; descricao: string; data: string; valor: number; href?: string }
export type LinhaDre = { chave: string; rotulo: string; valor: number; total: boolean; itens: ItemDre[] }

export const MAX_MESES_DRE = 12
const MES = /^\d{4}-(0[1-9]|1[0-2])$/

const somar = (xs: readonly ItemDre[]) => xs.reduce((s, x) => s + x.valor, 0)
const linha = (chave: string, rotulo: string, itens: ItemDre[]): LinhaDre => ({ chave, rotulo, valor: somar(itens), total: false, itens })
const total = (chave: string, rotulo: string, valor: number): LinhaDre => ({ chave, rotulo, valor, total: true, itens: [] })

// R153: Receita bruta · (−) Custos das saídas · = Margem · (−) Comissões · (−) each expense category · = Resultado.
export function montarDre(itens: readonly ItemDre[]): LinhaDre[] {
  const de = (g: ItemDre['grupo']) => itens.filter((i) => i.grupo === g)
  const receita = linha('receita', 'Receita bruta', de('receita'))
  const custo = linha('custo', '(−) Custos das saídas', de('custo'))
  const comissao = linha('comissao', '(−) Comissões', de('comissao'))
  const categorias = [...new Set(de('despesa').map((i) => i.categoria ?? 'Outros'))]
  const despesas = categorias
    .map((c) => linha(`despesa:${c}`, `(−) ${c}`, de('despesa').filter((i) => (i.categoria ?? 'Outros') === c)))
    .sort((a, b) => b.valor - a.valor)
  const margem = receita.valor - custo.valor
  const resultado = margem - comissao.valor - despesas.reduce((s, d) => s + d.valor, 0)
  // R163: with B2B sales, revenue shows as counter + B2B, then the gross total
  const b2b = de('receita').filter((i) => i.tarifa === 'b2b')
  const receitas = b2b.length === 0 ? [receita] : [
    linha('receita:balcao', 'Receita balcão', de('receita').filter((i) => i.tarifa !== 'b2b')),
    linha('receita:b2b', 'Receita B2B', b2b),
    total('receita', '= Receita bruta', receita.valor),
  ]
  return [...receitas, custo, total('margem', '= Margem', margem), comissao, ...despesas, total('resultado', '= Resultado', resultado)]
}

const GRUPO: Record<Movimento['origem'], ItemDre['grupo']> = { pagamento: 'receita', estorno: 'receita', custo: 'custo', comissao: 'comissao', conta: 'despesa' }

// Cash basis: the money that moved in the period (same source as the daily check). A refund is negative revenue.
export function itensCaixa(movimentos: readonly Movimento[]): ItemDre[] {
  return movimentos.map((m) => ({
    grupo: GRUPO[m.origem], categoria: m.categoria, tarifa: m.tarifa, descricao: m.descricao, data: m.data,
    valor: m.origem === 'estorno' ? -m.valor : m.valor, href: m.href,
  }))
}

const um = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')
const somarMeses = (mes: string, n: number) => {
  const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

export function mesesDoPeriodo(de: string, ate: string): string[] {
  const meses: string[] = []
  for (let m = de; m <= ate; m = somarMeses(m, 1)) meses.push(m)
  return meses
}

// ?de=YYYY-MM&ate=YYYY-MM&base=caixa|competencia; at most 12 months, ending at "ate".
export function lerPeriodoDre(p: Record<string, string | string[] | undefined>, hoje: string): PeriodoDre {
  const mesHoje = hoje.slice(0, 7)
  const ler = (v: string) => (MES.test(v) ? v : mesHoje)
  const [a, b] = [ler(um(p.de)), ler(um(p.ate))].sort()
  const base = (BASES_DRE as readonly string[]).includes(um(p.base)) ? (um(p.base) as BaseDre) : 'caixa'
  const minimo = somarMeses(b, -(MAX_MESES_DRE - 1))
  return { de: a < minimo ? minimo : a, ate: b, base }
}

export const rotuloPeriodo = ({ de, ate }: Pick<PeriodoDre, 'de' | 'ate'>) => (de === ate ? rotuloDoMes(de) : `${rotuloDoMes(de)} a ${rotuloDoMes(ate)}`)
export const ROTULO_BASE: Record<BaseDre, string> = { caixa: 'Caixa', competencia: 'Competência' }

// R154: lines first, then every entry behind them.
export function dreCsv(linhas: readonly LinhaDre[], periodo: PeriodoDre): string {
  return paraCsv(['DRE', ROTULO_BASE[periodo.base], rotuloPeriodo(periodo)], [
    ['Linha', 'Valor (R$)'],
    ...linhas.map((l) => [l.rotulo.replace(/^= /, ''), centavosParaCampo(l.valor)]), // a leading "=" would be escaped as a formula
    [],
    ['Linha', 'Data', 'Descrição', 'Valor (R$)'],
    ...linhas.flatMap((l) => l.itens.map((i) => [l.rotulo, formatarDataBr(i.data), i.descricao, centavosParaCampo(i.valor)])),
  ])
}

const SITUACAO = { paga: 'Paga', vencida: 'Vencida', proxima: 'Vence em breve', a_pagar: 'A pagar' } as const

export function aPagarCsv(linhas: readonly LinhaAPagar[], hoje: string): string {
  return paraCsv(['Descrição', 'Categoria', 'Fornecedor', 'Parcela', 'Vencimento', 'Valor (R$)', 'Situação', 'Pago em'],
    linhas.map((l) => [
      l.descricao, l.categoria, l.fornecedor, l.parcela, l.vencimento ? formatarDataBr(l.vencimento) : '', centavosParaCampo(l.valor),
      SITUACAO[situacaoAPagar(l, hoje)], l.pagoEm ? formatarDataBr(l.pagoEm) : '',
    ]))
}
