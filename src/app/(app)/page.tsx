import Link from 'next/link'
import { Suspense } from 'react'
import { ListaClientes } from '@/components/clientes/ListaClientes'
import { listarCidades, listarClientes, listarEtiquetas } from '@/lib/clientes/dados'
import { lerFiltros } from '@/lib/clientes/filtros'

export const metadata = { title: 'Clientes' }

async function Conteudo({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const filtros = lerFiltros(await searchParams)
  const [{ clientes, total }, etiquetas, cidades] = await Promise.all([
    listarClientes(filtros),
    listarEtiquetas(),
    listarCidades(),
  ])
  return <ListaClientes filtros={filtros} clientes={clientes} total={total} etiquetas={etiquetas} cidades={cidades} />
}

export default function Home({ searchParams }: PageProps<'/'>) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <div className="flex items-center gap-4">
          <Link href="/importar" className="text-primaria underline">Importar planilha</Link>
          <Link href="/clientes/novo" className="inline-flex min-h-12 items-center rounded-full bg-destaque px-6 font-semibold text-destaque-texto">
            Novo cliente
          </Link>
        </div>
      </div>
      <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </section>
  )
}
