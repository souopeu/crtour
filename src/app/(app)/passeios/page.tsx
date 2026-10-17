import Link from 'next/link'
import { Suspense } from 'react'
import { formatarDataBr } from '@/lib/formato'
import { listarPasseios } from '@/lib/passeios/dados'
import { Carregando } from '@/components/Carregando'

export const metadata = { title: 'Passeios' }

async function Lista({ searchParams }: Pick<PageProps<'/passeios'>, 'searchParams'>) {
  const arquivados = (await searchParams).arquivados === '1'
  const passeios = await listarPasseios(arquivados)
  return (
    <>
      <div className="flex items-center gap-4 text-sm">
        {arquivados
          ? <Link href="/passeios" className="min-h-11 inline-flex items-center text-primaria underline">Ver passeios ativos</Link>
          : <Link href="/passeios?arquivados=1" className="min-h-11 inline-flex items-center text-primaria underline">Ver arquivados</Link>}
      </div>
      {passeios.length === 0 ? (
        <p className="rounded-[--radius-cartao] border border-linha bg-superficie p-4">
          {arquivados ? 'Nenhum passeio arquivado.' : 'Você ainda não tem passeios. Crie o primeiro em "Novo passeio".'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {passeios.map((p) => (
            <li key={p.id}>
              <Link href={`/passeios/${p.id}`} className="flex min-h-14 flex-col gap-1 rounded-[--radius-cartao] border border-linha bg-superficie p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold">{p.nome}</span>
                <span className="flex flex-wrap gap-x-3 text-sm text-tinta-suave">
                  {p.destino && <span>{p.destino}</span>}
                  <span>{p.totalSaidas} {p.totalSaidas === 1 ? 'saída' : 'saídas'}</span>
                  {p.proximaSaida && <span>Próxima: {formatarDataBr(p.proximaSaida)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default function PasseiosPage({ searchParams }: PageProps<'/passeios'>) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Passeios</h1>
        <div className="flex items-center gap-4">
          <Link href="/fornecedores" className="text-primaria underline">Fornecedores</Link>
          <Link href="/passeios/novo" className="inline-flex min-h-12 items-center rounded-full bg-destaque px-6 font-semibold text-destaque-texto">Novo passeio</Link>
        </div>
      </div>
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </section>
  )
}
