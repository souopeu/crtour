import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { JanelaLateral } from '@/components/janela/JanelaLateral'
import { ConteudoNovoSegmento } from '@/app/(app)/remarketing/novo/ConteudoNovoSegmento'

export default function JanelaNovoSegmento({ searchParams }: PageProps<'/remarketing/novo'>) {
  return (
    <JanelaLateral titulo="Novo segmento">
      <div className="flex flex-col gap-6">
        <Suspense fallback={<Carregando altura="h-64" />}>
          <ConteudoNovoSegmento searchParams={searchParams} />
        </Suspense>
      </div>
    </JanelaLateral>
  )
}
