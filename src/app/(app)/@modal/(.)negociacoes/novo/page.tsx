import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { JanelaLateral } from '@/components/janela/JanelaLateral'
import { ConteudoNovaNegociacao } from '@/app/(app)/negociacoes/novo/ConteudoNovaNegociacao'

export default function JanelaNovaNegociacao({ searchParams }: PageProps<'/negociacoes/novo'>) {
  return (
    <JanelaLateral titulo="Nova negociação">
      <Suspense fallback={<Carregando altura="h-40" />}>
        <ConteudoNovaNegociacao searchParams={searchParams} />
      </Suspense>
    </JanelaLateral>
  )
}
