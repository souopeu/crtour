import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { ConteudoNovoCliente } from './ConteudoNovoCliente'

export const metadata = { title: 'Novo cliente' }

export default function NovoClientePage({ searchParams }: PageProps<'/clientes/novo'>) {
  return (
    <>
      <h1 className="mb-4 text-[1.75rem] font-medium tracking-tight">Novo cliente</h1>
      <Suspense fallback={<Carregando altura="h-64" />}>
        <ConteudoNovoCliente searchParams={searchParams} />
      </Suspense>
    </>
  )
}
