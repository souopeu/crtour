import Link from 'next/link'
import { Suspense } from 'react'
import { ListaClientes } from '@/components/clientes/ListaClientes'
import { listarCidades, listarClientes, listarEtiquetas } from '@/lib/clientes/dados'
import { hrefDaLista, lerFiltros } from '@/lib/clientes/filtros'
import { Carregando } from '@/components/Carregando'
import { AvisoCriterioSumido } from '@/components/filtros/AvisoCriterioSumido'
import { MeusFiltros } from '@/components/filtros/MeusFiltros'
import { botaoNovo } from '@/components/tela/estilos'
import { listarFiltrosSalvos } from '@/lib/filtros/dados'
import { semClienteInexistente } from '@/lib/filtros/filtrosSalvos'

export const metadata = { title: 'Clientes' }

async function Conteudo({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const [etiquetas, cidades, salvos] = await Promise.all([listarEtiquetas(), listarCidades(), listarFiltrosSalvos('clientes')])
  // R84: a deleted tag in the URL (e.g. from a saved filter) is dropped, with a warning
  const { filtros, sumiu } = semClienteInexistente(lerFiltros(await searchParams), etiquetas.map((e) => e.id))
  const { clientes, total } = await listarClientes(filtros)
  const abaixoDaBarra = (
    <>
      <MeusFiltros tela="clientes" atual={hrefDaLista({ ...filtros, pagina: 1 }).split('?')[1] ?? ''} filtros={salvos} />
      {sumiu && <AvisoCriterioSumido />}
    </>
  )
  return <ListaClientes filtros={filtros} clientes={clientes} total={total} etiquetas={etiquetas} cidades={cidades} abaixoDaBarra={abaixoDaBarra} />
}

export default function Home({ searchParams }: PageProps<'/'>) {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <div className="flex items-center gap-4">
          <Link href="/importar" className="text-primaria underline">Importar planilha</Link>
          <Link href="/clientes/novo" className={botaoNovo}>Novo cliente</Link>
        </div>
      </div>
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </section>
  )
}
