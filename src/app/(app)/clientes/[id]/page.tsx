import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AnotacoesCliente } from '@/components/clientes/AnotacoesCliente'
import { ChamarWhatsapp } from '@/components/clientes/ChamarWhatsapp'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { EtiquetasCliente } from '@/components/clientes/EtiquetasCliente'
import { getMembro } from '@/lib/auth/agencia'
import { getUsuario } from '@/lib/auth/usuario'
import { buscarAnotacoes, buscarCliente, buscarEtiquetas } from '@/lib/clientes/dados'
import { valoresDaLinha } from '@/lib/clientes/formulario'
import { formatarDataHora } from '@/lib/formato'
import { salvarCliente } from '../actions'

export const metadata = { title: 'Cliente' }

async function Ficha({ params }: Pick<PageProps<'/clientes/[id]'>, 'params'>) {
  const { id } = await params
  const cliente = await buscarCliente(id)
  if (!cliente) notFound()

  const [etiquetas, anotacoes, usuario, membro] = await Promise.all([
    buscarEtiquetas(cliente.id),
    buscarAnotacoes(cliente.id),
    getUsuario(),
    getMembro(),
  ])
  const aplicadasIds = new Set(etiquetas.aplicadas.map((e) => e.id))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight">{cliente.nome}</h1>
      <ChamarWhatsapp
        key={`${cliente.nome}|${cliente.whatsapp}|${cliente.consentimento_whatsapp}`}
        nome={cliente.nome}
        whatsapp={cliente.whatsapp}
        consentimento={cliente.consentimento_whatsapp}
      />
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <ClienteForm acao={salvarCliente.bind(null, cliente.id)} inicial={valoresDaLinha(cliente)} rotuloBotao="Salvar alterações" />
        <div className="flex max-w-xl flex-col gap-8 lg:max-w-none">
          <EtiquetasCliente
            clienteId={cliente.id}
            aplicadas={etiquetas.aplicadas}
            sugestoes={etiquetas.todas.filter((e) => !aplicadasIds.has(e.id))}
          />
          <AnotacoesCliente
            clienteId={cliente.id}
            anotacoes={anotacoes.map((a) => ({
              id: a.id,
              autor: a.autor_nome,
              quando: formatarDataHora(a.criada_em),
              texto: a.texto,
              podeApagar: a.autor_id === usuario?.id || membro?.papel === 'dono',
            }))}
          />
        </div>
      </div>
    </div>
  )
}

export default function ClientePage({ params }: PageProps<'/clientes/[id]'>) {
  return (
    <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-64" />}>
      <Ficha params={params} />
    </Suspense>
  )
}
