import Link from 'next/link'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { ConteudoNovoSegmento } from './ConteudoNovoSegmento'

export const metadata = { title: 'Novo segmento' }

export default function NovoSegmentoPage({ searchParams }: PageProps<'/remarketing/novo'>) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/remarketing" className="w-fit text-primaria underline">Voltar para Remarketing</Link>
      <h1 className="text-[1.75rem] font-medium tracking-tight">Novo segmento</h1>
      <Suspense fallback={<Carregando altura="h-64" />}>
        <ConteudoNovoSegmento searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
