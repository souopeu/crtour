import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { FormConta } from '@/components/contas/FormConta'
import { PagarLinha } from '@/components/contas/PagarLinha'
import { AbasFinanceiro } from '@/components/financeiro/AbasFinanceiro'
import { SoDono } from '@/components/financeiro/SoDono'
import { AbasDeVisao } from '@/components/tela/AbasDeVisao'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { botaoSecundario, caixaTabela, campoBarra, cartaoFiltros, rodapeTabela, rotuloBarra, tabelaPadrao } from '@/components/tela/estilos'
import { getMembro } from '@/lib/auth/agencia'
import { CATEGORIAS_CONTA, CATEGORIA_CUSTOS, FILTROS_A_PAGAR, filtrarAPagar, lerFiltroAPagar, rotuloCategoriaConta, situacaoAPagar, type FiltroAPagar, type SituacaoAPagar } from '@/lib/contas/contas'
import { listarAPagar } from '@/lib/contas/dados'
import { listarFornecedores } from '@/lib/custos/dados'
import { formatarDataBr, hojeNoBrasil, ouTraco } from '@/lib/formato'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { criarConta, pagar } from './actions'

export const metadata = { title: 'Contas a pagar' }

type Parametros = Awaited<PageProps<'/financeiro/contas'>['searchParams']>

const ROTULO_FILTRO: Record<FiltroAPagar, string> = { a_pagar: 'A pagar', vencidas: 'Vencidas', proximos7: 'Vencem em 7 dias', pagas: 'Pagas', todas: 'Todas' }
const SITUACAO: Record<SituacaoAPagar, { texto: string; classe: string }> = {
  vencida: { texto: 'Vencida', classe: 'bg-despesa-suave text-despesa' },
  proxima: { texto: 'Vence em breve', classe: 'bg-alerta-suave text-alerta' },
  a_pagar: { texto: 'A pagar', classe: 'bg-superficie-suave text-tinta' },
  paga: { texto: 'Paga', classe: 'bg-receita-suave text-receita' },
}

function hrefCom(params: Parametros, chave: string, valor: string | null) {
  const busca = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (k !== chave && typeof v === 'string') busca.set(k, v)
  if (valor) busca.set(chave, valor)
  const t = busca.toString()
  return t ? `/financeiro/contas?${t}` : '/financeiro/contas'
}

async function Lista({ searchParams }: Pick<PageProps<'/financeiro/contas'>, 'searchParams'>) {
  const [params, membro] = await Promise.all([searchParams, getMembro()])
  if (membro?.papel !== 'dono') return <SoDono />
  await connection() // "today" is per request
  const hoje = hojeNoBrasil()
  const f = lerFiltroAPagar(params)
  const [todas, fornecedores] = await Promise.all([listarAPagar(), listarFornecedores()])
  const linhas = filtrarAPagar(todas, f, hoje)
  const total = linhas.reduce((s, l) => s + l.valor, 0)
  const categorias = [...CATEGORIAS_CONTA.map(rotuloCategoriaConta), CATEGORIA_CUSTOS]

  return (
    <>
      <details className={cartaoFiltros}>
        <summary className="cursor-pointer text-base font-semibold text-primaria">+ Nova conta a pagar</summary>
        <div className="mt-3">
          <FormConta acao={criarConta} fornecedores={fornecedores} comModo rotuloBotao="Lançar conta"
            inicial={{ descricao: '', categoria: 'outros', valor: '', vencimento: hoje, fornecedor: '', observacao: '', modo: 'unica', parcelas: '' }} />
        </div>
      </details>
      <AbasDeVisao rotulo="Situação das contas" abas={FILTROS_A_PAGAR.map((x) => ({ rotulo: ROTULO_FILTRO[x], href: hrefCom(params, 'filtro', x === 'a_pagar' ? null : x), ativa: f.filtro === x }))} />
      <form method="get" action="/financeiro/contas" className="flex flex-wrap items-end gap-2">
        {f.filtro !== 'a_pagar' && <input type="hidden" name="filtro" value={f.filtro} />}
        <label className="flex flex-col gap-1"><span className={rotuloBarra}>Categoria</span>
          <select name="categoria" defaultValue={f.categoria ?? ''} className={campoBarra}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1"><span className={rotuloBarra}>Vencimento de</span><input type="date" name="de" defaultValue={f.de ?? ''} className={campoBarra} /></label>
        <label className="flex flex-col gap-1"><span className={rotuloBarra}>até</span><input type="date" name="ate" defaultValue={f.ate ?? ''} className={campoBarra} /></label>
        <button type="submit" className={botaoSecundario}>Filtrar</button>
        <a href={hrefCom(params, '', null).replace('/financeiro/contas', '/financeiro/contas/csv')} className={botaoSecundario}>Baixar CSV</a>
      </form>
      {linhas.length === 0 ? (
        <EstadoVazio compacto acoes={[]}>Nada neste filtro.</EstadoVazio>
      ) : (
        <div className={caixaTabela}>
          <table aria-label="Contas a pagar" className={`${tabelaPadrao} min-w-[52rem]`}>
            <thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Situação</th><th className="text-right">Valor</th><th><span className="sr-only">Ação</span></th></tr></thead>
            <tbody>
              {linhas.map((l) => {
                const s = SITUACAO[situacaoAPagar(l, hoje)]
                return (
                  <tr key={`${l.origem}-${l.id}`} className="hover:bg-superficie-suave">
                    <td className="whitespace-nowrap tabular-nums">{l.vencimento ? formatarDataBr(l.vencimento) : 'Sem data'}</td>
                    <td>
                      <Link href={l.href} className="font-medium text-primaria underline">{l.descricao}</Link>
                      <span className="block text-xs text-tinta-suave">{[l.parcela, l.fornecedor].filter(Boolean).join(' · ') || ouTraco(null)}</span>
                    </td>
                    <td>{l.categoria}</td>
                    <td><span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${s.classe}`}>{s.texto}</span>{l.pagoEm && <span className="block text-xs text-tinta-suave">em {formatarDataBr(l.pagoEm)}</span>}</td>
                    <td className="text-right tabular-nums">{formatarReais(l.valor)}</td>
                    <td>{!l.pagoEm && <PagarLinha acao={pagar.bind(null, l.origem, l.id)} hoje={hoje} descricao={l.descricao} />}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot><tr className={rodapeTabela}><td colSpan={4}>{linhas.length} {linhas.length === 1 ? 'lançamento' : 'lançamentos'}</td><td className="text-right tabular-nums">{formatarReais(total)}</td><td /></tr></tfoot>
          </table>
        </div>
      )}
    </>
  )
}

export default function ContasPage({ searchParams }: PageProps<'/financeiro/contas'>) {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4">
      <CabecalhoPagina area="Financeiro" titulo="Contas a pagar" descricao="Contas da agência e custos das saídas, num lugar só." />
      <AbasFinanceiro caminho="/financeiro/contas" />
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </section>
  )
}
