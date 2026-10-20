import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { JanelaLateral } from '@/components/janela/JanelaLateral'
import { ConteudoNovoCliente } from '@/app/(app)/clientes/novo/ConteudoNovoCliente'

export default function JanelaNovoCliente({ searchParams }: PageProps<'/clientes/novo'>) {
  return (
    <JanelaLateral titulo="Novo cliente">
      <Suspense fallback={<Carregando altura="h-64" />}>
        <ConteudoNovoCliente searchParams={searchParams} />
      </Suspense>
    </JanelaLateral>
  )
}
