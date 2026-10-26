import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { AbasFinanceiro } from '@/components/financeiro/AbasFinanceiro'
import { ConferirDia } from '@/components/financeiro/ConferirDia'
import { SoDono } from '@/components/financeiro/SoDono'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { SeletorDeDia } from '@/components/tela/SeletorDeDia'
import { caixaTabela, cartaoFiltros, cartaoPainel, rodapeTabela, tabelaPadrao } from '@/components/tela/estilos'
import { getMembro } from '@/lib/auth/agencia'
import { ROTULO_FORMA, totaisDoDia, type Forma, type Movimento } from '@/lib/financeiro/conferencia'
import { movimentosDoDia, type Conferencia } from '@/lib/financeiro/dados'
import { formatarDataHora, hojeNoBrasil } from '@/lib/formato'
import { lerDia } from '@/lib/operacao/operacao'
import { formatarReais } from '@/lib/passeios/dinheiro'

export const metadata = { title: 'Conferência diária' }

const ORIGEM: Record<Movimento['origem'], string> = { pagamento: 'Recebimento', estorno: 'Estorno', conta: 'Conta paga', custo: 'Custo de saída', comissao: 'Comissão paga' }
const forma = (f: Forma | null) => (f ? ROTULO_FORMA[f] : 'Sem forma')
const reais = (v: number) => (v === 0 ? '—' : formatarReais(v))

function Situacao({ conferencia }: { conferencia: Conferencia | null }) {
  if (!conferencia) return <p className="font-semibold">Este dia ainda não foi conferido.</p>
  if (conferencia.invalidadaEm) {
    return (
      <p role="status" className="rounded-lg bg-alerta-suave px-3 py-2 font-semibold text-alerta">
        Um lançamento deste dia mudou em {formatarDataHora(conferencia.invalidadaEm)}, depois da conferência de {conferencia.por}. Confira de novo.
      </p>
    )
  }
  return (
    <div role="status" className="rounded-lg bg-receita-suave px-3 py-2 text-receita">
      <p className="font-semibold">Conferido por {conferencia.por} em {formatarDataHora(conferencia.em)}.</p>
      {conferencia.observacao && <p className="text-sm">{conferencia.observacao}</p>}
    </div>
  )
}

async function Conteudo({ searchParams }: Pick<PageProps<'/financeiro/conferencia'>, 'searchParams'>) {
  const [sp, membro] = await Promise.all([searchParams, getMembro()])
  if (membro?.papel !== 'dono') return <SoDono />
  await connection() // "today" is per request
  const hoje = hojeNoBrasil()
  const lido = lerDia(sp.dia, hoje)
  const dia = lido > hoje ? hoje : lido
  const { movimentos, conferencia } = await movimentosDoDia(dia)
  const t = totaisDoDia(movimentos)

  return (
    <>
      <SeletorDeDia caminho="/financeiro/conferencia" rotulo="Dia do caixa" dia={dia} hoje={hoje} max={hoje} />

      <section aria-label="Totais do dia" className="grid gap-3 sm:grid-cols-3">
        <div className={cartaoPainel}><h2 className="text-sm text-tinta-suave">Entradas</h2><p className="text-2xl font-bold text-receita">{formatarReais(t.entradas)}</p></div>
        <div className={cartaoPainel}><h2 className="text-sm text-tinta-suave">Saídas</h2><p className="text-2xl font-bold text-despesa">{formatarReais(t.saidas)}</p></div>
        <div className={cartaoPainel}><h2 className="text-sm text-tinta-suave">Saldo do dia</h2><p className="text-2xl font-bold">{formatarReais(t.saldo)}</p></div>
      </section>

      {movimentos.length === 0 ? <p className="text-sm text-tinta-suave">Nenhum dinheiro entrou ou saiu neste dia.</p> : (
        <>
          <div className={caixaTabela}>
            <table aria-label="Totais por forma de pagamento" className={`${tabelaPadrao} min-w-[32rem]`}>
              <thead><tr><th>Forma</th><th className="text-right">Entradas</th><th className="text-right">Saídas</th><th className="text-right">Saldo</th></tr></thead>
              <tbody>
                {t.porForma.map((f) => (
                  <tr key={f.forma ?? 'sem'}>
                    <td>{forma(f.forma)}</td>
                    <td className="text-right tabular-nums">{reais(f.entradas)}</td>
                    <td className="text-right tabular-nums">{reais(f.saidas)}</td>
                    <td className="text-right font-semibold tabular-nums">{formatarReais(f.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={caixaTabela}>
            <table aria-label="Movimentos do dia" className={`${tabelaPadrao} min-w-[44rem]`}>
              <thead><tr><th>Tipo</th><th>Descrição</th><th>Forma</th><th className="text-right">Entrada</th><th className="text-right">Saída</th></tr></thead>
              <tbody>
                {movimentos.map((m) => (
                  <tr key={`${m.origem}-${m.id}`}>
                    <td>{ORIGEM[m.origem]}</td>
                    <td>{m.href ? <Link href={m.href} className="text-primaria underline">{m.descricao}</Link> : m.descricao}</td>
                    <td>{forma(m.forma)}</td>
                    <td className="text-right tabular-nums text-receita">{m.sentido === 'entrada' ? formatarReais(m.valor) : ''}</td>
                    <td className="text-right tabular-nums text-despesa">{m.sentido === 'saida' ? formatarReais(m.valor) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={rodapeTabela}>
                  <td colSpan={3}>Total · {movimentos.length} {movimentos.length === 1 ? 'movimento' : 'movimentos'}</td>
                  <td className="text-right tabular-nums">{formatarReais(t.entradas)}</td>
                  <td className="text-right tabular-nums">{formatarReais(t.saidas)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      <section aria-labelledby="conferencia-titulo" className={cartaoFiltros}>
        <h2 id="conferencia-titulo" className="text-lg font-semibold">Conferência</h2>
        <Situacao conferencia={conferencia} />
        <ConferirDia key={`${dia}-${conferencia?.em ?? ''}`} dia={dia} observacao={conferencia?.observacao ?? null}
          rotulo={conferencia && !conferencia.invalidadaEm ? 'Conferir de novo' : 'Conferi este dia'} />
      </section>
    </>
  )
}

export default function ConferenciaPage({ searchParams }: PageProps<'/financeiro/conferencia'>) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <CabecalhoPagina area="Financeiro" titulo="Conferência diária" descricao="O que entrou e saiu do caixa no dia, por forma de pagamento. Marque o dia como conferido; se um lançamento mudar, a marca cai." />
      <AbasFinanceiro caminho="/financeiro/conferencia" />
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
