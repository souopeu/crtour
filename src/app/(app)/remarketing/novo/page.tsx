import Link from 'next/link'
import { Suspense } from 'react'
import { criarSegmento } from '@/app/(app)/remarketing/actions'
import { FiltrosSegmento } from '@/components/remarketing/FiltrosSegmento'
import { FormSegmento } from '@/components/remarketing/FormSegmento'
import { PreviaSegmento } from '@/components/remarketing/PreviaSegmento'
import { listarCidades, listarEtiquetas } from '@/lib/clientes/dados'
import { clientesDoSegmento } from '@/lib/segmentos/dados'
import { criteriosParaQuery, lerCriterios } from '@/lib/segmentos/segmentos'
import { Carregando } from '@/components/Carregando'

export const metadata = { title: 'Novo segmento' }

async function Conteudo({ searchParams }: Pick<PageProps<'/remarketing/novo'>, 'searchParams'>) {
  const criterios = lerCriterios(await searchParams)
  const [etiquetas, cidades, clientes] = await Promise.all([listarEtiquetas(), listarCidades(), clientesDoSegmento(criterios)])
  return (
    <>
      <FiltrosSegmento criterios={criterios} etiquetas={etiquetas} cidades={cidades} />

      <PreviaSegmento criterios={criterios} clientes={clientes} etiquetas={new Map(etiquetas.map((e) => [e.id, e.nome]))} />

      <section aria-labelledby="salvar-titulo" className="flex flex-col gap-2">
        <h2 id="salvar-titulo" className="text-lg font-semibold">Salvar segmento</h2>
        <FormSegmento acao={criarSegmento} criterios={criteriosParaQuery(criterios)} inicial={{ nome: '', mensagem: 'Olá, {nome}! Tudo bem? Temos novidades de {destino} para você.' }} rotuloBotao="Salvar segmento" />
      </section>
    </>
  )
}

export default function NovoSegmentoPage({ searchParams }: PageProps<'/remarketing/novo'>) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/remarketing" className="w-fit text-primaria underline">Voltar para Remarketing</Link>
      <h1 className="text-[1.75rem] font-medium tracking-tight">Novo segmento</h1>
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
