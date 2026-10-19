import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { salvarCriterios } from '@/app/(app)/remarketing/actions'
import { Carregando } from '@/components/Carregando'
import { FiltrosSegmento } from '@/components/remarketing/FiltrosSegmento'
import { PreviaSegmento } from '@/components/remarketing/PreviaSegmento'
import { listarCidades, listarEtiquetas } from '@/lib/clientes/dados'
import { buscarSegmento, clientesDoSegmento } from '@/lib/segmentos/dados'
import { criteriosParaQuery, lerCriterios } from '@/lib/segmentos/segmentos'

export const metadata = { title: 'Editar critérios' }

async function Conteudo({ params, searchParams }: PageProps<'/remarketing/[id]/editar'>) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const segmento = await buscarSegmento(id)
  if (!segmento) notFound()
  // First visit shows the saved criteria; after "Ver clientes" the URL carries the new ones.
  const criterios = Object.keys(sp).length > 0 ? lerCriterios(sp) : segmento.criterios
  const [etiquetas, cidades, clientes] = await Promise.all([listarEtiquetas(), listarCidades(), clientesDoSegmento(criterios)])
  return (
    <>
      <h1 className="text-[1.75rem] font-medium tracking-tight">Editar critérios de &quot;{segmento.nome}&quot;</h1>
      <FiltrosSegmento criterios={criterios} etiquetas={etiquetas} cidades={cidades} acao={`/remarketing/${segmento.id}/editar`} />
      <PreviaSegmento criterios={criterios} clientes={clientes} etiquetas={new Map(etiquetas.map((e) => [e.id, e.nome]))} />
      <form action={salvarCriterios.bind(null, segmento.id, criteriosParaQuery(criterios))} className="flex flex-wrap items-center gap-3">
        <button type="submit" className="min-h-12 rounded-full bg-destaque px-6 font-semibold text-destaque-texto">Salvar critérios</button>
        <Link href={`/remarketing/${segmento.id}`} className="text-primaria underline">Cancelar</Link>
      </form>
      <p className="text-sm text-tinta-suave">Quem já foi chamado nesta rodada continua marcado. Quem deixar de casar com os critérios sai da fila.</p>
    </>
  )
}

export default function EditarCriteriosPage(props: PageProps<'/remarketing/[id]/editar'>) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo {...props} />
      </Suspense>
    </div>
  )
}
