import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { ConteudoNovaNegociacao } from './ConteudoNovaNegociacao'

export const metadata = { title: 'Nova negociação' }

export default function NovaNegociacaoPage({ searchParams }: PageProps<'/negociacoes/novo'>) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-[1.75rem] font-medium tracking-tight">Nova negociação</h1>
      <Suspense fallback={<Carregando altura="h-40" />}>
        <ConteudoNovaNegociacao searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
