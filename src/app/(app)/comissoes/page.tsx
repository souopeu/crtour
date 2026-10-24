import Link from 'next/link'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { getMembro } from '@/lib/auth/agencia'
import { rotuloDaRegra, totaisPorVendedor } from '@/lib/comissao/comissao'
import { buscarConfigComissao, listarComissoes } from '@/lib/comissao/dados'
import { formatarDataBr, hojeNoBrasil } from '@/lib/formato'
import { lerFiltrosPainel, rotuloDoMes } from '@/lib/painel/painel'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { botaoBarra, caixaTabela, campoBarra, cartaoPainel, rodapeTabela, rotuloBarra, tabelaPadrao } from '@/components/tela/estilos'

export const metadata = { title: 'Comissões' }

async function Conteudo({ searchParams }: Pick<PageProps<'/comissoes'>, 'searchParams'>) {
  const [membro, sp] = await Promise.all([getMembro(), searchParams])
  if (!membro) return null
  const mes = lerFiltrosPainel(sp, hojeNoBrasil(), []).mes
  const [config, linhas] = await Promise.all([buscarConfigComissao(), listarComissoes(mes)])
  const ehDono = membro.papel === 'dono'
  const nome = new Map(config.membros.map((m) => [m.user_id, m.nome]))
  const total = linhas.reduce((s, l) => s + l.comissao_centavos, 0)

  if (!config.regra) {
    return <EstadoVazio acoes={ehDono ? [{ href: '/configuracoes', rotulo: 'Configurações' }] : []}>A agência ainda não usa comissão. {ehDono ? 'Escolha a regra em Configurações.' : 'Fale com o dono da agência.'}</EstadoVazio>
  }
  return (
    <>
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
      <CabecalhoPagina area="Financeiro" titulo="Comissões" descricao="O que cada vendedor recebe pelas reservas quitadas no mês." />
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
