import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { AbasFinanceiro } from '@/components/financeiro/AbasFinanceiro'
import { SoDono } from '@/components/financeiro/SoDono'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { botaoBarra, botaoSecundario, caixaTabela, campoBarra, cartaoFiltros, rotuloBarra, tabelaPadrao } from '@/components/tela/estilos'
import { getMembro } from '@/lib/auth/agencia'
import { BASES_DRE, ROTULO_BASE, lerPeriodoDre, montarDre, rotuloPeriodo, type BaseDre, type LinhaDre } from '@/lib/financeiro/dre'
import { itensDre } from '@/lib/financeiro/dreDados'
import { formatarDataBr, hojeNoBrasil } from '@/lib/formato'
import { formatarReais } from '@/lib/passeios/dinheiro'

export const metadata = { title: 'DRE' }

const EXPLICACAO: Record<BaseDre, string> = {
  caixa: 'Caixa: o dinheiro que entrou e saiu no período, pela data do pagamento. Estornos diminuem a receita; uma conta que vence no período mas foi paga depois não entra.',
  competencia: 'Competência: receita e custos das saídas que aconteceram no período (pela data do passeio, pago ou não), comissões pelo mês em que a reserva ficou quitada e contas pelo vencimento, pagas ou não.',
}

function Linha({ l }: { l: LinhaDre }) {
  const valor = <span className={`tabular-nums ${l.valor < 0 ? 'text-despesa' : ''}`}>{formatarReais(l.valor)}</span>
  if (l.total) {
    return <tr className="bg-superficie-suave font-semibold"><th scope="row">{l.rotulo}</th><td className="text-right">{valor}</td></tr>
  }
  return (
    <tr>
      <th scope="row" className="font-normal">
        {l.rotulo}
        {l.itens.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs text-primaria">Ver {l.itens.length} {l.itens.length === 1 ? 'lançamento' : 'lançamentos'}</summary>
            <ul aria-label={`O que compõe ${l.rotulo}`} className="mt-2 flex flex-col gap-1 text-xs">
              {l.itens.map((i, n) => (
                <li key={`${i.href ?? ''}-${n}`} className="flex flex-wrap gap-x-2">
                  <span className="tabular-nums text-tinta-suave">{formatarDataBr(i.data)}</span>
                  {i.href ? <Link href={i.href} className="text-primaria underline">{i.descricao}</Link> : <span>{i.descricao}</span>}
                  <span className="tabular-nums">{formatarReais(i.valor)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </th>
      <td className="text-right align-top">{valor}</td>
    </tr>
  )
}

async function Conteudo({ searchParams }: Pick<PageProps<'/financeiro/dre'>, 'searchParams'>) {
  const [sp, membro] = await Promise.all([searchParams, getMembro()])
  if (membro?.papel !== 'dono') return <SoDono />
  await connection() // "today" is per request
  const periodo = lerPeriodoDre(sp, hojeNoBrasil())
  const linhas = montarDre(await itensDre(periodo))
  const busca = new URLSearchParams(periodo).toString()

  return (
    <>
      <form method="get" aria-label="Período da DRE" className={`${cartaoFiltros} sm:flex-row sm:flex-wrap sm:items-end`}>
        <div className="flex flex-col gap-1">
          <label htmlFor="de" className={rotuloBarra}>De</label>
          <input id="de" name="de" type="month" defaultValue={periodo.de} className={campoBarra} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ate" className={rotuloBarra}>Até</label>
          <input id="ate" name="ate" type="month" defaultValue={periodo.ate} className={campoBarra} />
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className={rotuloBarra}>Base</legend>
          <div className="flex h-10 items-center gap-4">
            {BASES_DRE.map((b) => (
              <label key={b} className="flex items-center gap-1 text-sm">
                <input type="radio" name="base" value={b} defaultChecked={periodo.base === b} /> {ROTULO_BASE[b]}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className={botaoBarra}>Ver</button>
      </form>
      <p className="text-sm text-tinta-suave">Até 12 meses. {EXPLICACAO[periodo.base]}</p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{rotuloPeriodo(periodo)} · {ROTULO_BASE[periodo.base]}</h2>
        <a href={`/financeiro/dre/csv?${busca}`} className={botaoSecundario}>Baixar CSV</a>
      </div>
      <div className={caixaTabela}>
        <table aria-label="DRE" className={`${tabelaPadrao} min-w-[28rem]`}>
          <thead><tr><th>Linha</th><th className="text-right">Valor</th></tr></thead>
          <tbody>{linhas.map((l) => <Linha key={l.chave} l={l} />)}</tbody>
        </table>
      </div>
    </>
  )
}

export default function DrePage({ searchParams }: PageProps<'/financeiro/dre'>) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <CabecalhoPagina area="Financeiro" titulo="DRE" descricao="Receita, custos, comissões e despesas do período, em caixa ou competência. Abra cada linha para ver o que a compõe." />
      <AbasFinanceiro caminho="/financeiro/dre" />
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
