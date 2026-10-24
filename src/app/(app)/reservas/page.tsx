import Link from 'next/link'
import { Suspense } from 'react'
import { formatarDataBr, hojeNoBrasil, ouTraco } from '@/lib/formato'
import { lerPeriodo } from '@/lib/periodo/periodo'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { RESERVAS } from '@/lib/reservas/config'
import { listarReservas, type SituacaoLista } from '@/lib/reservas/dados'
import { Carregando } from '@/components/Carregando'
import { AbasDeVisao } from '@/components/tela/AbasDeVisao'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { FiltroPeriodo } from '@/components/tela/FiltroPeriodo'
import { botaoPrincipal, botaoSecundario, caixaTabela, rodapeTabela, tabelaPadrao } from '@/components/tela/estilos'

export const metadata = { title: 'Reservas' }

type Parametros = Awaited<PageProps<'/reservas'>['searchParams']>

function hrefAba(params: Parametros, aba: SituacaoLista) {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(params)) if (chave !== 'aba' && typeof valor === 'string') busca.set(chave, valor)
  if (aba === 'cancelada') busca.set('aba', 'canceladas')
  const texto = busca.toString()
  return texto ? `/reservas?${texto}` : '/reservas'
}

async function Lista({ searchParams }: Pick<PageProps<'/reservas'>, 'searchParams'>) {
  const params = await searchParams
  const situacao: SituacaoLista = params.aba === 'canceladas' ? 'cancelada' : 'ativa'
  const periodo = lerPeriodo(params, hojeNoBrasil())
  const { linhas, cortado } = await listarReservas(periodo, situacao)
  const totalPessoas = linhas.reduce((s, r) => s + r.pessoas, 0)
  const totalSaldo = linhas.reduce((s, r) => s + r.saldo, 0)

  return (
    <>
      <FiltroPeriodo base="/reservas" periodo={periodo} params={params} titulo="Período das reservas" dica="Pela data da saída do passeio." />
      <AbasDeVisao rotulo="Situação das reservas" abas={[
        { rotulo: 'Ativas', href: hrefAba(params, 'ativa'), ativa: situacao === 'ativa' },
        { rotulo: 'Canceladas', href: hrefAba(params, 'cancelada'), ativa: situacao === 'cancelada' },
      ]} />
      {linhas.length === 0 ? (
        situacao === 'ativa'
          ? <EstadoVazio acoes={[{ href: '/passeios', rotulo: 'Ver passeios e saídas' }]}>Nenhuma reserva neste período. As reservas nascem dentro de uma saída do passeio.</EstadoVazio>
          : <p className="rounded-(--radius-cartao) border border-linha bg-superficie p-4">Nenhuma reserva cancelada neste período.</p>
      ) : (
        <div className={caixaTabela}>
          <table aria-label="Reservas" className={`${tabelaPadrao} min-w-[44rem]`}>
            <thead><tr><th>Cliente</th><th>Passeio</th><th>Saída</th><th className="text-right">Pessoas</th><th className="text-right">Total</th><th className="text-right">Falta receber</th></tr></thead>
            <tbody>
              {linhas.map((r) => (
                <tr key={r.id} className="hover:bg-superficie-suave">
                  <td><Link href={`/reservas/${r.id}`} className="font-medium text-primaria underline">{r.clienteNome}</Link></td>
                  <td>{ouTraco(r.passeio)}</td>
                  <td><Link href={`/saidas/${r.saidaId}`} className="underline-offset-2 hover:underline">{formatarDataBr(r.saidaData)}</Link></td>
                  <td className="text-right tabular-nums">{r.pessoas}</td>
                  <td className="text-right tabular-nums">{formatarReais(r.total)}</td>
                  <td className={`text-right tabular-nums ${r.saldo > 0 ? 'font-semibold text-despesa' : 'text-tinta-suave'}`}>{r.saldo > 0 ? formatarReais(r.saldo) : 'Quitada'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={rodapeTabela}>
                <td>Total</td>
                <td colSpan={2} className="font-normal text-tinta-suave">{linhas.length} {linhas.length === 1 ? 'reserva' : 'reservas'}</td>
                <td className="text-right tabular-nums">{totalPessoas}</td>
                <td />
                <td className="text-right tabular-nums">{formatarReais(totalSaldo)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {cortado && <p className="text-sm text-tinta-suave">Mostrando as primeiras {RESERVAS.maxLinhas} reservas. Use um período menor para ver as outras.</p>}
    </>
  )
}

export default function ReservasPage({ searchParams }: PageProps<'/reservas'>) {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4">
      <CabecalhoPagina area="Reservas" titulo="Reservas" descricao="Todas as reservas da agência, pela data da saída.">
        <Link href="/passeios" className={botaoPrincipal}>Nova reserva</Link>
        <a href="/exportar?tipo=reservas" className={botaoSecundario}>Exportar reservas</a>
      </CabecalhoPagina>
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </section>
  )
}
