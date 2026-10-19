import Link from 'next/link'
import { Suspense } from 'react'
import { formatarDataBr, ouTraco } from '@/lib/formato'
import { listarPasseios } from '@/lib/passeios/dados'
import { Carregando } from '@/components/Carregando'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { AbasDeVisao } from '@/components/tela/AbasDeVisao'
import { botaoNovo, caixaTabela, rodapeTabela, tabelaPadrao } from '@/components/tela/estilos'

export const metadata = { title: 'Passeios' }

async function Lista({ searchParams }: Pick<PageProps<'/passeios'>, 'searchParams'>) {
  const arquivados = (await searchParams).arquivados === '1'
  const passeios = await listarPasseios(arquivados)
  return (
    <>
      <AbasDeVisao rotulo="Visões dos passeios" abas={[
        { rotulo: 'Ativos', href: '/passeios', ativa: !arquivados },
        { rotulo: 'Arquivados', href: '/passeios?arquivados=1', ativa: arquivados },
      ]} />
      {passeios.length === 0 ? (
        arquivados
          ? <p className="rounded-(--radius-cartao) border border-linha bg-superficie p-4">Nenhum passeio arquivado.</p>
          : <EstadoVazio acoes={[{ href: '/passeios/novo', rotulo: 'Criar o primeiro passeio' }]}>Você ainda não tem passeios. Crie o passeio e depois as saídas com data e vagas.</EstadoVazio>
      ) : (
        <div className={caixaTabela}>
          <table aria-label="Passeios" className={`${tabelaPadrao} min-w-[32rem]`}>
            <thead><tr><th>Passeio</th><th>Destino</th><th>Saídas</th><th>Próxima saída</th></tr></thead>
            <tbody>
              {passeios.map((p) => (
                <tr key={p.id} className="hover:bg-superficie-suave">
                  <td><Link href={`/passeios/${p.id}`} className="font-medium text-primaria underline">{p.nome}</Link></td>
                  <td>{ouTraco(p.destino)}</td>
                  <td>{p.totalSaidas} {p.totalSaidas === 1 ? 'saída' : 'saídas'}</td>
                  <td>{ouTraco(p.proximaSaida ? formatarDataBr(p.proximaSaida) : null)}</td>
                </tr>
              ))}
              {!arquivados && <tr><td colSpan={4}><Link href="/passeios/novo" className="text-sm text-tinta-suave hover:text-primaria hover:underline">+ Adicionar passeio</Link></td></tr>}
            </tbody>
            <tfoot><tr className={rodapeTabela}><td>Total</td><td colSpan={3} className="font-normal text-tinta-suave">{passeios.length} {passeios.length === 1 ? 'passeio' : 'passeios'}</td></tr></tfoot>
          </table>
        </div>
      )}
    </>
  )
}

export default function PasseiosPage({ searchParams }: PageProps<'/passeios'>) {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[1.75rem] font-medium tracking-tight">Passeios</h1>
        <div className="flex items-center gap-4">
          <Link href="/fornecedores" className="text-primaria underline">Fornecedores</Link>
          <Link href="/passeios/novo" className={botaoNovo}>Novo passeio</Link>
        </div>
      </div>
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </section>
  )
}
