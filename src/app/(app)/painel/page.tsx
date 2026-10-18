import { Suspense } from 'react'
import { FormMeta } from '@/components/painel/FormMeta'
import { getMembro } from '@/lib/auth/agencia'
import { hojeNoBrasil } from '@/lib/formato'
import { listarMembros, listarNegociacoes } from '@/lib/negociacoes/dados'
import { rotuloDaEtapa, rotuloDoMotivo } from '@/lib/negociacoes/negociacoes'
import { atividadesPorPessoa, buscarMeta, etapasAntesDaPerda, type AtividadesPessoa } from '@/lib/painel/dados'
import { margem } from '@/lib/custos/custos'
import { custosDoMes } from '@/lib/custos/dados'
import { calcularPainel, lerFiltrosPainel, progressoMeta, rotuloDoMes } from '@/lib/painel/painel'
import { centavosParaCampo, formatarReais } from '@/lib/passeios/dinheiro'
import { Carregando } from '@/components/Carregando'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { blocoEtapa } from '@/components/negociacoes/coresEtapa'
import { botaoBarra, caixaTabela, campoBarra, cartaoPainel, rotuloBarra, tabelaPadrao } from '@/components/tela/estilos'

export const metadata = { title: 'Painel' }

const pct = (x: number) => `${Math.round(x * 100)}%`
const cartao = cartaoPainel
// Small dashboard tables reuse the framed table look (R61).
const Tabela = ({ children }: { children: React.ReactNode }) => <div className={caixaTabela}><table className={tabelaPadrao}>{children}</table></div>

const COLUNAS_ATIVIDADE = [['ligacao', 'Ligações'], ['whatsapp', 'WhatsApp'], ['email', 'E-mails'], ['reuniao', 'Reuniões'], ['tarefa', 'Tarefas']] as const

// Spec 18, R88: owner only; the database refuses anyone else (R89).
function AtividadesPorPessoa({ linhas, rotulo }: { linhas: AtividadesPessoa[] | null; rotulo: string }) {
  return (
    <section aria-labelledby="atividades-pessoa-titulo" className="flex flex-col gap-2">
      <h2 id="atividades-pessoa-titulo" className="text-lg font-semibold">Atividades por pessoa em {rotulo}</h2>
      {linhas === null ? <p role="alert" className="text-sm">Não foi possível carregar as atividades por pessoa.</p> : (
        <Tabela>
          <thead>
            <tr>
              <th>Pessoa</th>
              {COLUNAS_ATIVIDADE.map(([, r]) => <th key={r}>{r}</th>)}
              <th>Total feitas</th><th>Atrasadas (hoje)</th><th>Ganhas no mês</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.pessoa_id ?? 'sem'}>
                <td>{l.nome}</td>
                {COLUNAS_ATIVIDADE.map(([c]) => <td key={c} className="tabular-nums">{l[c]}</td>)}
                <td className="font-semibold tabular-nums">{l.feitas}</td>
                <td className="tabular-nums">{l.atrasadas}</td>
                <td className="tabular-nums">{l.ganhas}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </section>
  )
}

function Numero({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return (
    <div className={cartao}>
      <p className="text-sm text-tinta-suave">{titulo}</p>
      <p className="text-2xl font-bold">{valor}</p>
      {detalhe && <p className="text-sm text-tinta-suave">{detalhe}</p>}
    </div>
  )
}

function Meta({ mes, meta, efetivo }: { mes: string; meta: number | null; efetivo: number }) {
  const rotulo = rotuloDoMes(mes)
  if (meta === null) {
    return (
      <section aria-labelledby="meta-titulo" className={cartao}>
        <h2 id="meta-titulo" className="text-lg font-semibold">Meta de {rotulo}</h2>
        <p className="text-sm">Nenhuma meta definida para este mês. Defina uma para acompanhar quanto falta.</p>
        <FormMeta mes={mes} rotuloMes={rotulo} atual="" />
      </section>
    )
  }
  const { fracao, falta } = progressoMeta(efetivo, meta)
  return (
    <section aria-labelledby="meta-titulo" className={cartao}>
      <h2 id="meta-titulo" className="text-lg font-semibold">Meta de {rotulo}</h2>
      <div role="meter" aria-label="Receita efetiva em relação à meta" aria-valuemin={0} aria-valuemax={meta} aria-valuenow={efetivo}
        aria-valuetext={`${pct(fracao)} da meta`} className="h-4 w-full overflow-hidden rounded-full bg-superficie-suave">
        <div className="h-full rounded-full bg-receita" style={{ width: `${Math.min(100, fracao * 100)}%` }} />
      </div>
      <p><strong>{formatarReais(efetivo)}</strong> de {formatarReais(meta)} ({pct(fracao)})</p>
      <p className="text-sm text-tinta-suave">{falta > 0 ? `Faltam ${formatarReais(falta)}.` : 'Meta batida!'}</p>
      <details>
        <summary className="min-h-11 cursor-pointer content-center text-sm text-primaria underline">Mudar a meta</summary>
        <FormMeta mes={mes} rotuloMes={rotulo} atual={centavosParaCampo(meta)} />
      </details>
    </section>
  )
}

async function Conteudo({ searchParams }: Pick<PageProps<'/painel'>, 'searchParams'>) {
  const membro = await getMembro()
  if (!membro) return null
  const ehDono = membro.papel === 'dono'
  const [sp, negociacoes, membros, antes] = await Promise.all([searchParams, listarNegociacoes(), listarMembros(), etapasAntesDaPerda()])
  const hoje = hojeNoBrasil()
  // R41: a seller only ever sees her own numbers, whatever the URL says.
  const filtros = ehDono ? lerFiltrosPainel(sp, hoje, membros.map((m) => m.user_id)) : { ...lerFiltrosPainel(sp, hoje, []), responsavel: membro.user_id }
  const [meta, doMes, porPessoa] = await Promise.all([
    buscarMeta(filtros.mes), ehDono ? custosDoMes(filtros.mes) : Promise.resolve(null), ehDono ? atividadesPorPessoa(filtros.mes) : Promise.resolve(null),
  ])
  const p = calcularPainel(
    negociacoes
      .filter((n) => !filtros.responsavel || n.responsavel_id === filtros.responsavel)
      .map((n) => ({
        etapa: n.etapa, valor: n.valor_centavos, previsto: n.valor_previsto_centavos, responsavelId: n.responsavel_id, fechadoEm: n.fechado_em,
        etapaDesde: n.etapa_desde, motivo: n.motivo_perda, dataEsperada: n.data_fechamento_esperada, etapaAntesDaPerda: antes.get(n.id) ?? null,
      })),
    filtros.mes, hoje,
  )
  const rotulo = rotuloDoMes(filtros.mes)

  return (
    <>
      <form method="get" aria-label="Filtros do painel" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="mes" className={rotuloBarra}>Mês</label>
          <input id="mes" name="mes" type="month" defaultValue={filtros.mes} className={campoBarra} />
        </div>
        {ehDono && <div className="flex flex-col gap-1">
          <label htmlFor="responsavel" className={rotuloBarra}>Responsável</label>
          <select id="responsavel" name="responsavel" defaultValue={filtros.responsavel ?? ''} className={campoBarra}>
            <option value="">Toda a agência</option>
            {membros.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
          </select>
        </div>}
        <button type="submit" className={botaoBarra}>Ver</button>
      </form>

      {doMes && !filtros.responsavel && doMes.saidas > 0 && (() => {
        // Costs and margin come from departures, not deals: shown even with an empty funnel.
        const m = margem(doMes.receita, doMes.custos)
        return <Numero titulo={`Margem das saídas de ${rotulo}`} valor={formatarReais(m.margem)}
          detalhe={`${doMes.saidas} ${doMes.saidas === 1 ? 'saída' : 'saídas'} · vendido ${formatarReais(m.receita)} · custos ${formatarReais(m.custos)}`} />
      })()}

      {p.vazio ? (
        <EstadoVazio acoes={[{ href: '/funil', rotulo: 'Abrir o funil' }]}>Ainda não há negociações{filtros.responsavel ? ' deste responsável' : ''}. O painel se monta sozinho a partir delas: crie no funil ou pela ficha de um cliente.</EstadoVazio>
      ) : (
        <>
          {!ehDono ? (
            <p className="text-sm text-tinta-suave">Estes são os números das negociações em que você é a pessoa responsável.</p>
          ) : filtros.responsavel ? (
            <p className="text-sm text-tinta-suave">A meta é da agência toda; escolha &quot;Toda a agência&quot; para ver o andamento dela.</p>
          ) : (
            <Meta mes={filtros.mes} meta={meta} efetivo={p.receita.valor} />
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Numero titulo={`Receita efetiva em ${rotulo}`} valor={formatarReais(p.receita.valor)} detalhe={`${p.receita.quantidade} ${p.receita.quantidade === 1 ? 'venda' : 'vendas'} em Pago ou depois`} />
            <Numero titulo="Ticket médio" valor={p.receita.ticketMedio === null ? '—' : formatarReais(p.receita.ticketMedio)} />
            <Numero titulo="Conversão no mês" valor={p.conversao.taxa === null ? '—' : pct(p.conversao.taxa)} detalhe={`${p.conversao.ganhas} ganhas · ${p.conversao.perdidas} perdidas`} />
            <Numero titulo="Pipeline aberto (agora)" valor={formatarReais(p.pipeline.valor)} detalhe={`${p.pipeline.quantidade} em aberto · previsto ${formatarReais(p.pipeline.previsto)}`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="etapas-titulo" className="flex flex-col gap-2">
            <h2 id="etapas-titulo" className="text-lg font-semibold">Por etapa (agora, igual ao kanban)</h2>
            <Tabela>
              <thead><tr><th>Etapa</th><th>Qtde.</th><th>Valor</th><th>Previsto</th></tr></thead>
              <tbody>
                {p.porEtapa.map((e) => (
                  <tr key={e.etapa}><td><span className={blocoEtapa(e.etapa)}>{rotuloDaEtapa(e.etapa)}</span></td><td>{e.quantidade}</td><td>{formatarReais(e.valor)}</td><td>{formatarReais(e.previsto)}</td></tr>
                ))}
              </tbody>
            </Tabela>
          </section>

          <section aria-labelledby="funil-titulo" className="flex flex-col gap-2">
            <h2 id="funil-titulo" className="text-lg font-semibold">Funil (todas as negociações até hoje)</h2>
            <Tabela>
              <thead><tr><th>Etapa</th><th>Chegaram</th><th>Queda</th></tr></thead>
              <tbody>
                {p.funil.map((f) => (
                  <tr key={f.etapa}><td>{rotuloDaEtapa(f.etapa)}</td><td>{f.chegaram}</td><td>{f.queda === null ? '—' : pct(f.queda)}</td></tr>
                ))}
              </tbody>
            </Tabela>
            <p className="text-sm text-tinta-suave">Perdidas contam até a etapa em que estavam quando foram perdidas.</p>
          </section>

          <section aria-labelledby="perdas-titulo" className="flex flex-col gap-2">
            <h2 id="perdas-titulo" className="text-lg font-semibold">Perdas por motivo em {rotulo}</h2>
            {p.perdas.length === 0 ? <p className="text-sm text-tinta-suave">Nenhuma perda neste mês.</p> : (
              <Tabela>
                <thead><tr><th>Motivo</th><th>Qtde.</th><th>Valor</th></tr></thead>
                <tbody>{p.perdas.map((x) => <tr key={x.motivo}><td>{rotuloDoMotivo(x.motivo)}</td><td>{x.quantidade}</td><td>{formatarReais(x.valor)}</td></tr>)}</tbody>
              </Tabela>
            )}
          </section>

          <section aria-labelledby="previsao-titulo" className="flex flex-col gap-2">
            <h2 id="previsao-titulo" className="text-lg font-semibold">Previsão por mês (data esperada de fechamento)</h2>
            {p.previsao.length === 0 ? <p className="text-sm text-tinta-suave">Nenhuma negociação em aberto.</p> : (
              <Tabela>
                <thead><tr><th>Mês</th><th>Qtde.</th><th>Previsto</th></tr></thead>
                <tbody>
                  {p.previsao.map((x) => (
                    <tr key={x.chave}>
                      <td>{x.chave === 'atrasada' ? 'Data já passou' : x.chave === 'sem_data' ? 'Sem data' : rotuloDoMes(x.chave)}</td>
                      <td>{x.quantidade}</td><td>{formatarReais(x.previsto)}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            )}
          </section>
          </div>
        </>
      )}

      {ehDono && <AtividadesPorPessoa linhas={porPessoa} rotulo={rotulo} />}
    </>
  )
}

export default function PainelPage({ searchParams }: PageProps<'/painel'>) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Painel</h1>
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
