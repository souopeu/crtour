import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { buscarCliente } from '@/lib/clientes/dados'
import { valoresDaLinha } from '@/lib/clientes/formulario'
import { salvarCliente } from '../actions'

export const metadata = { title: 'Cliente' }

async function Ficha({ params }: Pick<PageProps<'/clientes/[id]'>, 'params'>) {
  const { id } = await params
  const cliente = await buscarCliente(id)
  if (!cliente) notFound()
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{cliente.nome}</h1>
      <ClienteForm acao={salvarCliente.bind(null, cliente.id)} inicial={valoresDaLinha(cliente)} rotuloBotao="Salvar alterações" />
    </>
  )
}

export default function ClientePage({ params }: PageProps<'/clientes/[id]'>) {
  return (
    <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-64" />}>
      <Ficha params={params} />
    </Suspense>
  )
}
