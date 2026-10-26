import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { desfazerComissaoPaga } from '@/app/(app)/financeiro/pagamentos-actions'
import { PagarComissao } from '@/components/financeiro/PagarComissao'
import { Repasses } from '@/components/financeiro/Repasses'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { AbasDeVisao } from '@/components/tela/AbasDeVisao'
import { listarAPagar } from '@/lib/contas/dados'
import { acertoPorVendedor, agruparRepasses, type Acerto } from '@/lib/financeiro/pagamentosFeitos'
import { Carregando } from '@/components/Carregando'
import { getMembro } from '@/lib/auth/agencia'
import { rotuloDaRegra, totaisPorVendedor } from '@/lib/comissao/comissao'
import { buscarConfigComissao, listarComissoes, listarComissoesPagas, type ComissaoPaga } from '@/lib/comissao/dados'
import { formatarDataBr, hojeNoBrasil } from '@/lib/formato'
import { lerFiltrosPainel, rotuloDoMes } from '@/lib/painel/painel'
import { centavosParaCampo, formatarReais } from '@/lib/passeios/dinheiro'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { AbasFinanceiro } from '@/components/financeiro/AbasFinanceiro'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { botaoBarra, caixaTabela, campoBarra, cartaoPainel, rodapeTabela, rotuloBarra, tabelaPadrao } from '@/components/tela/estilos'

export const metadata = { title: 'Comissões' }

const FORMA = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência', outro: 'Outro' } as const

// R150: everything still to pay to suppliers, grouped, paid in a batch (owner only).
async function RepassesFornecedores() {
  await connection()
  return <Repasses grupos={agruparRepasses(await listarAPagar())} hoje={hojeNoBrasil()} />
}

// R149: per person, due vs paid in the month; the owner pays the difference, a seller sees her own.
function Acerto({ acertos, pagas, nome, ehDono, mes, hoje }: {
  acertos: Acerto[]; pagas: ComissaoPaga[]; nome: Map<string, string>; ehDono: boolean; mes: string; hoje: string
}) {
  if (acertos.length === 0) return null
  return (
    <section aria-labelledby="acerto-titulo" className="flex flex-col gap-3">
      <h2 id="acerto-titulo" className="text-lg font-semibold">Pagamento das comissões</h2>
      <div className={caixaTabela}>
        <table aria-label="Pagamento das comissões" className={`${tabelaPadrao} min-w-[40rem]`}>
          <thead><tr><th>Pessoa</th><th className="text-right">Devido</th><th className="text-right">Pago</th><th className="text-right">A acertar</th>{ehDono && <th><span className="sr-only">Ação</span></th>}</tr></thead>
          <tbody>
            {acertos.map((a) => (
              <tr key={a.vendedorId}>
                <td>{nome.get(a.vendedorId) ?? 'Pessoa removida'}</td>
                <td className="text-right tabular-nums">{formatarReais(a.devido)}</td>
                <td className="text-right tabular-nums">{formatarReais(a.pago)}</td>
                <td className={`text-right tabular-nums ${a.aAcertar > 0 ? 'font-semibold text-despesa' : a.aAcertar < 0 ? 'text-alerta' : 'text-receita'}`}>
                  {a.aAcertar === 0 ? 'Em dia' : a.aAcertar > 0 ? formatarReais(a.aAcertar) : `Pago a mais ${formatarReais(-a.aAcertar)}`}
                </td>
                {ehDono && <td>{a.aAcertar > 0 && <PagarComissao key={a.aAcertar /* closes after a payment changes the balance */} vendedorId={a.vendedorId} nome={nome.get(a.vendedorId) ?? 'pessoa'} mes={mes} sugerido={centavosParaCampo(a.aAcertar)} hoje={hoje} />}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagas.length > 0 && (
        <ul aria-label="Pagamentos feitos" className="flex flex-col gap-1 text-sm">
          {pagas.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3">
              <span>{nome.get(p.vendedor_id) ?? 'Pessoa removida'}: <strong>{formatarReais(p.valor_centavos)}</strong> em {formatarDataBr(p.pago_em)} · {FORMA[p.forma_pago]}</span>
              {ehDono && p.comprovante_id && <a href={`/financeiro/comprovante/${p.comprovante_id}`} target="_blank" rel="noopener noreferrer" className="text-primaria underline">Comprovante</a>}
              {ehDono && <ConfirmarExclusao acao={desfazerComissaoPaga.bind(null, p.id)} rotulo="Remover" rotuloConfirmar="Remover pagamento" rotuloVoltar="Voltar" aviso="Apaga este registro de pagamento; o valor volta para “a acertar”." />}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

async function Conteudo({ searchParams }: Pick<PageProps<'/comissoes'>, 'searchParams'>) {
  const [membro, sp] = await Promise.all([getMembro(), searchParams])
  if (!membro) return null
  const ehDono = membro.papel === 'dono'
  const verRepasses = ehDono && sp.ver === 'repasses'
  const abas = ehDono ? (
    <AbasDeVisao rotulo="Comissões ou repasses" abas={[
      { rotulo: 'Comissões', href: '/comissoes', ativa: !verRepasses },
      { rotulo: 'Repasses a fornecedores', href: '/comissoes?ver=repasses', ativa: verRepasses },
    ]} />
  ) : null
  if (verRepasses) return <>{abas}<RepassesFornecedores /></>

  await connection()
  const hoje = hojeNoBrasil()
  const mes = lerFiltrosPainel(sp, hoje, []).mes
  const [config, linhas, pagas] = await Promise.all([buscarConfigComissao(), listarComissoes(mes), listarComissoesPagas(mes)])
  const nome = new Map(config.membros.map((m) => [m.user_id, m.nome]))
  const total = linhas.reduce((s, l) => s + l.comissao_centavos, 0)
  const acertos = acertoPorVendedor(totaisPorVendedor(linhas), pagas)

  if (!config.regra) {
    return <>{abas}<EstadoVazio acoes={ehDono ? [{ href: '/configuracoes', rotulo: 'Configurações' }] : []}>A agência ainda não usa comissão. {ehDono ? 'Escolha a regra em Configurações.' : 'Fale com o dono da agência.'}</EstadoVazio></>
  }
  return (
    <>
      {abas}
      <form method="get" aria-label="Mês das comissões" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="mes" className={rotuloBarra}>Mês</label>
          <input id="mes" name="mes" type="month" defaultValue={mes} className={campoBarra} />
        </div>
        <button type="submit" className={botaoBarra}>Ver</button>
      </form>
      <p className="text-sm text-tinta-suave">
        Regra: {rotuloDaRegra(config.regra)}. A comissão entra no mês em que a reserva ficou quitada; estorno que reabre o saldo tira a comissão até quitar de novo.
        {!ehDono && ' Você vê só as suas.'}
      </p>

      <section aria-labelledby="total-titulo" className={cartaoPainel}>
        <h2 id="total-titulo" className="text-sm text-tinta-suave">Comissões de {rotuloDoMes(mes)}</h2>
        <p className="text-2xl font-bold">{formatarReais(total)}</p>
        {ehDono && linhas.length > 0 && (
          <ul aria-label="Por pessoa" className="text-sm">
            {totaisPorVendedor(linhas).map((t) => (
              <li key={t.vendedorId ?? 'sem'}>{t.vendedorId ? (nome.get(t.vendedorId) ?? 'Pessoa removida') : 'Sem vendedor(a)'}: <strong>{formatarReais(t.total)}</strong> ({t.quantidade} {t.quantidade === 1 ? 'reserva' : 'reservas'})</li>
            ))}
          </ul>
        )}
      </section>

      <Acerto acertos={acertos} pagas={pagas} nome={nome} ehDono={ehDono} mes={mes} hoje={hoje} />

      {linhas.length === 0 ? <p className="text-sm text-tinta-suave">Nenhuma reserva quitada neste mês.</p> : (
        <div className={caixaTabela}>
        <table className={`${tabelaPadrao} min-w-[44rem]`}>
          <thead><tr><th>Quitada em</th><th>Cliente</th><th>Passeio</th>{ehDono && <th>Vendido por</th>}<th>Valor</th><th>Comissão</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.reserva_id} className="hover:bg-superficie-suave">
                <td>{formatarDataBr(l.quitada_em)}</td>
                <td><Link href={`/reservas/${l.reserva_id}`} className="text-primaria underline">{l.cliente_nome}</Link></td>
                <td>{l.passeio_nome} · {formatarDataBr(l.saida_data)} · {l.qtd_pessoas} {l.qtd_pessoas === 1 ? 'pessoa' : 'pessoas'}</td>
                {ehDono && <td>{l.vendedor_id ? (nome.get(l.vendedor_id) ?? 'Pessoa removida') : 'Sem vendedor(a)'}</td>}
                <td>{formatarReais(l.valor_total_centavos)}</td>
                <td><strong>{formatarReais(l.comissao_centavos)}</strong></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={rodapeTabela}>
              <td>Total</td>
              <td colSpan={ehDono ? 4 : 3} className="font-normal text-tinta-suave">{linhas.length} {linhas.length === 1 ? 'reserva' : 'reservas'}</td>
              <td>{formatarReais(total)}</td>
            </tr>
          </tfoot>
        </table>
        </div>
      )}
    </>
  )
}

export default function ComissoesPage({ searchParams }: PageProps<'/comissoes'>) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <CabecalhoPagina area="Financeiro" titulo="Comissões e repasses" descricao="O que cada vendedor recebe pelas reservas quitadas e o que a agência deve a cada fornecedor." />
      <AbasFinanceiro caminho="/comissoes" />
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
