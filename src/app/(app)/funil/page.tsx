import Link from 'next/link'
import { Suspense } from 'react'
import { diaNoBrasil, formatarDataBr, hojeNoBrasil } from '@/lib/formato'
import { diasAte } from '@/lib/pagamentos/cobranca'
import { KanbanFunil } from '@/components/negociacoes/KanbanFunil'
import { buscarLimites } from '@/lib/hoje/dados'
import { estaParada } from '@/lib/hoje/hoje'
import { listarNegociacoes, listarSaidasParaSelecao } from '@/lib/negociacoes/dados'
import { agruparNegociacoes } from '@/lib/negociacoes/negociacoes'
import { formatarReais } from '@/lib/passeios/dinheiro'

export const metadata = { title: 'Funil' }

async function Conteudo({ searchParams }: Pick<PageProps<'/funil'>, 'searchParams'>) {
  const sp = await searchParams
  const visao = sp.visao === 'tabela' ? 'tabela' : 'kanban'
  const por = sp.agrupar === 'responsavel' ? 'responsavel' : 'etapa'
  const [negociacoes, saidas, limites] = await Promise.all([listarNegociacoes(), listarSaidasParaSelecao(), buscarLimites()])
  const hoje = hojeNoBrasil()
  const rotuloSaida = new Map(saidas.map((s) => [s.id, s.rotulo]))
  const grupos = agruparNegociacoes(
    negociacoes.map((n) => ({ id: n.id, etapa: n.etapa, valor: n.valor_centavos, previsto: n.valor_previsto_centavos, responsavelId: n.responsavel_id, responsavelNome: n.responsavel_nome })),
    por,
  )
  const porId = new Map(negociacoes.map((n) => [n.id, n]))
  const totalValor = negociacoes.reduce((s, n) => s + n.valor_centavos, 0)
  const totalPrevisto = negociacoes.reduce((s, n) => s + n.valor_previsto_centavos, 0)

  const abas = [
    { chave: 'kanban', rotulo: 'Kanban', href: '/funil', ativa: visao === 'kanban' },
    { chave: 'etapa', rotulo: 'Tabela por etapa', href: '/funil?visao=tabela', ativa: visao === 'tabela' && por === 'etapa' },
    { chave: 'responsavel', rotulo: 'Tabela por responsável', href: '/funil?visao=tabela&agrupar=responsavel', ativa: visao === 'tabela' && por === 'responsavel' },
  ]
  return (
    <>
      <nav aria-label="Visões do funil" className="flex flex-wrap gap-2">
        {abas.map((a) => (
          <Link key={a.chave} href={a.href} aria-current={a.ativa ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 ${a.ativa ? 'border-primaria bg-primaria text-white' : 'border-linha bg-superficie'}`}>
            {a.rotulo}
          </Link>
        ))}
      </nav>

      {negociacoes.length === 0 ? (
        <p className="rounded-[--radius-cartao] border border-linha bg-superficie p-4">
          Nenhuma negociação ainda. Crie a primeira em &quot;Nova negociação&quot; ou pela ficha de um cliente.
        </p>
      ) : visao === 'kanban' ? (
        <KanbanFunil
          cartoes={negociacoes.map((n) => ({
            id: n.id, titulo: n.titulo, clienteId: n.cliente_id, clienteNome: n.cliente_nome, etapa: n.etapa, valor: n.valor_centavos,
            previsto: n.valor_previsto_centavos, probabilidade: n.probabilidade, responsavelNome: n.responsavel_nome,
            saidaRotulo: n.saida_id ? (rotuloSaida.get(n.saida_id) ?? null) : null,
            diasNaEtapa: -diasAte(diaNoBrasil(n.etapa_desde), hoje),
            parada: estaParada(n.etapa, n.etapa_desde, limites.dias_negociacao_parada, hoje),
          }))}
        />
      ) : (
        <>
          <p aria-live="polite" className="text-tinta-suave">
            {negociacoes.length} {negociacoes.length === 1 ? 'negociação' : 'negociações'} · valor {formatarReais(totalValor)} · <strong>previsto {formatarReais(totalPrevisto)}</strong>
          </p>
          <div className="flex flex-col gap-6">
            {grupos.map((g) => (
              <section key={g.chave} aria-labelledby={`g-${g.chave}`} className="overflow-x-auto rounded-[--radius-cartao] border border-linha bg-superficie">
                <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-linha bg-superficie-suave px-4 py-3">
                  <h2 id={`g-${g.chave}`} className="text-lg font-semibold">{g.rotulo} <span className="font-normal text-tinta-suave">({g.quantidade})</span></h2>
                  <p className="text-sm">Valor {formatarReais(g.totalValor)} · <strong>previsto {formatarReais(g.totalPrevisto)}</strong></p>
                </header>
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-linha text-tinta-suave">
                      <th className="px-4 py-2 font-medium">Negociação</th>
                      <th className="px-2 py-2 font-medium">Cliente</th>
                      <th className="px-2 py-2 text-right font-medium">Valor</th>
                      <th className="px-2 py-2 text-right font-medium">Prob.</th>
                      <th className="px-2 py-2 text-right font-medium">Previsto</th>
                      <th className="px-2 py-2 font-medium">Responsável</th>
                      <th className="px-2 py-2 font-medium">Esperado</th>
                      <th className="px-4 py-2 font-medium">Na etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.itens.map((i) => {
                      const n = porId.get(i.id)!
                      const dias = -diasAte(diaNoBrasil(n.etapa_desde), hoje)
                      return (
                        <tr key={n.id} className="border-b border-linha last:border-b-0">
                          <td className="px-4 py-2"><Link href={`/negociacoes/${n.id}`} className="font-medium text-primaria underline">{n.titulo}</Link></td>
                          <td className="px-2 py-2"><Link href={`/clientes/${n.cliente_id}`} className="underline">{n.cliente_nome}</Link></td>
                          <td className="px-2 py-2 text-right">{formatarReais(n.valor_centavos)}</td>
                          <td className="px-2 py-2 text-right">{n.probabilidade}%</td>
                          <td className="px-2 py-2 text-right font-medium">{formatarReais(n.valor_previsto_centavos)}</td>
                          <td className="px-2 py-2">{n.responsavel_nome ?? '—'}</td>
                          <td className="px-2 py-2">{n.data_fechamento_esperada ? formatarDataBr(n.data_fechamento_esperada) : '—'}</td>
                          <td className="px-4 py-2">{dias <= 0 ? 'hoje' : `${dias} ${dias === 1 ? 'dia' : 'dias'}`}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
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
        <Link href="/negociacoes/novo" className="inline-flex min-h-12 items-center rounded-full bg-destaque px-6 font-semibold text-destaque-texto">Nova negociação</Link>
      </div>
      <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-40" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </section>
  )
}
