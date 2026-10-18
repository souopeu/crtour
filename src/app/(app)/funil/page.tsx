import Link from 'next/link'
import { Suspense } from 'react'
import { diaNoBrasil, formatarDataBr, hojeNoBrasil, ouTraco } from '@/lib/formato'
import { diasAte } from '@/lib/pagamentos/cobranca'
import { KanbanFunil } from '@/components/negociacoes/KanbanFunil'
import { COR_ETAPA, blocoEtapa } from '@/components/negociacoes/coresEtapa'
import { AbasDeVisao } from '@/components/tela/AbasDeVisao'
import { GrupoRecolhivel } from '@/components/tela/GrupoRecolhivel'
import { botaoBarra, botaoNovo, campoBarra, chip, rotuloBarra } from '@/components/tela/estilos'
import { buscarLimites } from '@/lib/hoje/dados'
import { estaParada } from '@/lib/hoje/hoje'
import { carregarSugestoes } from '@/lib/negociacoes/sugestoesDados'
import { listarMembros, listarNegociacoes, listarSaidasParaSelecao } from '@/lib/negociacoes/dados'
import { filtrarNegociacoes, hrefFunil, lerFiltroFunil, type FiltroFunil } from '@/lib/negociacoes/filtroFunil'
import { agruparNegociacoes, rotuloDaEtapa, type Etapa } from '@/lib/negociacoes/negociacoes'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { Carregando } from '@/components/Carregando'

export const metadata = { title: 'Funil' }

// R60: search, person and grouping travel in the URL, so every view and tab keeps them.
// Field ids carry the view: Next keeps the previous view mounted (hidden), and a repeated id would point a label at it.
function Barra({ f, membros }: { f: FiltroFunil; membros: { user_id: string; nome: string }[] }) {
  return (
    <form method="get" action="/funil" role="search" aria-label="Filtros do funil" className="flex flex-wrap items-end gap-3">
      {f.visao === 'tabela' && <input type="hidden" name="visao" value="tabela" />}
      <div className="flex flex-col gap-1">
        <label htmlFor={`q-${f.visao}`} className={rotuloBarra}>Buscar negociação</label>
        <input id={`q-${f.visao}`} name="q" type="search" defaultValue={f.q} maxLength={100} placeholder="Título ou cliente" className={`${campoBarra} w-56`} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`pessoa-${f.visao}`} className={rotuloBarra}>Pessoa</label>
        <select id={`pessoa-${f.visao}`} name="pessoa" defaultValue={f.pessoa ?? ''} className={campoBarra}>
          <option value="">Todas</option>
          {membros.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
          <option value="sem">Sem responsável</option>
        </select>
      </div>
      {f.visao === 'tabela' ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={`agrupar-${f.visao}`} className={rotuloBarra}>Agrupar por</label>
          <select id={`agrupar-${f.visao}`} name="agrupar" defaultValue={f.agrupar} className={campoBarra}>
            <option value="etapa">Etapa</option>
            <option value="responsavel">Responsável</option>
          </select>
        </div>
      ) : f.agrupar === 'responsavel' && <input type="hidden" name="agrupar" value="responsavel" />}
      <button type="submit" className={botaoBarra}>Aplicar</button>
      {(f.q || f.pessoa) && <Link href={hrefFunil({ ...f, q: '', pessoa: null })} className="inline-flex min-h-10 items-center text-sm text-primaria underline">Limpar</Link>}
    </form>
  )
}

async function Conteudo({ searchParams }: Pick<PageProps<'/funil'>, 'searchParams'>) {
  const f = lerFiltroFunil(await searchParams)
  const [todas, membros, saidas, limites, sugestoes] = await Promise.all([listarNegociacoes(), listarMembros(), listarSaidasParaSelecao(), buscarLimites(), carregarSugestoes()])
  const negociacoes = filtrarNegociacoes(todas, f)
  const hoje = hojeNoBrasil()
  const rotuloSaida = new Map(saidas.map((s) => [s.id, s.rotulo]))
  const grupos = agruparNegociacoes(
    negociacoes.map((n) => ({ id: n.id, etapa: n.etapa, valor: n.valor_centavos, previsto: n.valor_previsto_centavos, responsavelId: n.responsavel_id, responsavelNome: n.responsavel_nome })),
    f.agrupar,
  )
  const porId = new Map(negociacoes.map((n) => [n.id, n]))
  const totalValor = negociacoes.reduce((s, n) => s + n.valor_centavos, 0)
  const totalPrevisto = negociacoes.reduce((s, n) => s + n.valor_previsto_centavos, 0)
  const porResponsavel = f.agrupar === 'responsavel'
  const colunas = porResponsavel ? 9 : 8

  return (
    <>
      <AbasDeVisao rotulo="Visões do funil" abas={[
        { rotulo: 'Kanban', href: hrefFunil({ ...f, visao: 'kanban' }), ativa: f.visao === 'kanban' },
        { rotulo: 'Tabela', href: hrefFunil({ ...f, visao: 'tabela' }), ativa: f.visao === 'tabela' },
      ]} />
      <Barra f={f} membros={membros} />

      {todas.length === 0 ? (
        <p className="rounded-(--radius-cartao) border border-linha bg-superficie p-4">
          Nenhuma negociação ainda. Crie a primeira em &quot;Nova negociação&quot; ou pela ficha de um cliente.
        </p>
      ) : negociacoes.length === 0 ? (
        <p className="rounded-(--radius-cartao) border border-linha bg-superficie p-4">
          Nenhuma negociação combina com a busca ou a pessoa escolhida. <Link href={hrefFunil({ ...f, q: '', pessoa: null })} className="text-primaria underline">Limpar filtros</Link>
        </p>
      ) : f.visao === 'kanban' ? (
        <KanbanFunil
          cartoes={negociacoes.map((n) => ({
            id: n.id, titulo: n.titulo, clienteId: n.cliente_id, clienteNome: n.cliente_nome, etapa: n.etapa, valor: n.valor_centavos,
            previsto: n.valor_previsto_centavos, probabilidade: n.probabilidade, responsavelNome: n.responsavel_nome,
            saidaRotulo: n.saida_id ? (rotuloSaida.get(n.saida_id) ?? null) : null,
            diasNaEtapa: -diasAte(diaNoBrasil(n.etapa_desde), hoje),
            parada: estaParada(n.etapa, n.etapa_desde, limites.dias_negociacao_parada, hoje),
            sugestao: sugestoes.get(n.id),
          }))}
        />
      ) : (
        <>
          <p aria-live="polite" className="text-sm text-tinta-suave">
            {negociacoes.length} {negociacoes.length === 1 ? 'negociação' : 'negociações'} · valor {formatarReais(totalValor)} · <strong>previsto {formatarReais(totalPrevisto)}</strong>
          </p>
          <div className="flex flex-col gap-4">
            {grupos.map((g) => (
              <GrupoRecolhivel
                key={g.chave} id={`g-${g.chave}`} titulo={g.rotulo} quantidade={g.quantidade}
                borda={porResponsavel ? 'border-l-primaria' : COR_ETAPA[g.chave as Etapa].borda}
                resumo={<>Valor {formatarReais(g.totalValor)} · <strong className="text-tinta">previsto {formatarReais(g.totalPrevisto)}</strong></>}
              >
                <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="h-(--linha-tabela) border-b border-linha text-xs text-tinta-suave">
                      <th className="px-3 font-medium">Negociação</th>
                      <th className="px-2 font-medium">Cliente</th>
                      {porResponsavel && <th className="px-2 font-medium">Etapa</th>}
                      <th className="px-2 text-right font-medium">Valor</th>
                      <th className="px-2 text-right font-medium">Prob.</th>
                      <th className="px-2 text-right font-medium">Previsto</th>
                      <th className="px-2 font-medium">Responsável</th>
                      <th className="px-2 font-medium">Esperado</th>
                      <th className="px-3 font-medium">Na etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.itens.map((i) => {
                      const n = porId.get(i.id)!
                      const dias = -diasAte(diaNoBrasil(n.etapa_desde), hoje)
                      return (
                        <tr key={n.id} className="h-(--linha-tabela) border-b border-linha hover:bg-superficie-suave">
                          <td className="px-3 py-1"><Link href={`/negociacoes/${n.id}`} className="font-medium text-primaria underline">{n.titulo}</Link></td>
                          <td className="px-2 py-1"><Link href={`/clientes/${n.cliente_id}`} className={chip}>{n.cliente_nome}</Link></td>
                          {porResponsavel && <td className="px-2 py-1"><span className={blocoEtapa(n.etapa)}>{rotuloDaEtapa(n.etapa)}</span></td>}
                          <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{formatarReais(n.valor_centavos)}</td>
                          <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{n.probabilidade}%</td>
                          <td className="px-2 py-1 whitespace-nowrap text-right font-medium tabular-nums">{formatarReais(n.valor_previsto_centavos)}</td>
                          <td className="px-2 py-1">{ouTraco(n.responsavel_nome)}</td>
                          <td className="px-2 py-1">{ouTraco(formatarDataBr(n.data_fechamento_esperada))}</td>
                          <td className="px-3 py-1">{dias <= 0 ? 'hoje' : `${dias} ${dias === 1 ? 'dia' : 'dias'}`}</td>
                        </tr>
                      )
                    })}
                    <tr className="h-(--linha-tabela) border-b border-linha">
                      <td colSpan={colunas} className="px-3"><Link href="/negociacoes/novo" className="text-sm text-tinta-suave hover:text-primaria hover:underline">+ Adicionar negociação</Link></td>
                    </tr>
                  </tbody>
                  <tfoot>
                    {/* No probability sum: adding percentages means nothing (template error seen in the monday analysis). */}
                    <tr className="h-(--linha-tabela) bg-superficie-suave text-sm font-semibold">
                      <td className="px-3">Total</td>
                      <td className="px-2 font-normal text-tinta-suave" colSpan={porResponsavel ? 2 : 1}>{g.quantidade} {g.quantidade === 1 ? 'negociação' : 'negociações'}</td>
                      <td className="whitespace-nowrap px-2 text-right tabular-nums">{formatarReais(g.totalValor)}</td>
                      <td className="px-2" />
                      <td className="whitespace-nowrap px-2 text-right tabular-nums">{formatarReais(g.totalPrevisto)}</td>
                      <td className="px-3" colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </GrupoRecolhivel>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export default function FunilPage({ searchParams }: PageProps<'/funil'>) {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Funil de vendas</h1>
        <Link href="/negociacoes/novo" className={botaoNovo}>Nova negociação</Link>
      </div>
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </section>
  )
}
