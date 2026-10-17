import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AnotacoesCliente } from '@/components/clientes/AnotacoesCliente'
import { ChamarWhatsapp } from '@/components/clientes/ChamarWhatsapp'
import { ClienteForm } from '@/components/clientes/ClienteForm'
import { EtiquetasCliente } from '@/components/clientes/EtiquetasCliente'
import { getMembro } from '@/lib/auth/agencia'
import { getUsuario } from '@/lib/auth/usuario'
import { buscarAnotacoes, buscarCliente, buscarEtiquetas, listarViagensDoCliente } from '@/lib/clientes/dados'
import { separarViagens } from '@/lib/clientes/viagens'
import { AtividadesCliente } from '@/components/atividades/AtividadesCliente'
import { LinhaDoTempo } from '@/components/atividades/LinhaDoTempo'
import { atrasadaAgora, montarLinhaDoTempo, textoUltimaInteracao, isoParaDataHoraLocal } from '@/lib/atividades/atividades'
import { buscarUltimaInteracao, listarAtividadesDoCliente } from '@/lib/atividades/dados'
import { listarMembros } from '@/lib/negociacoes/dados'
import { NegociacoesDoCliente } from '@/components/clientes/NegociacoesDoCliente'
import { listarNegociacoesDoCliente } from '@/lib/negociacoes/dados'
import { HistoricoDeViagens } from '@/components/clientes/HistoricoDeViagens'
import { valoresDaLinha } from '@/lib/clientes/formulario'
import { formatarDataHora, hojeNoBrasil } from '@/lib/formato'
import { salvarCliente } from '../actions'

export const metadata = { title: 'Cliente' }

async function Ficha({ params }: Pick<PageProps<'/clientes/[id]'>, 'params'>) {
  const { id } = await params
  const cliente = await buscarCliente(id)
  if (!cliente) notFound()

  const [etiquetas, anotacoes, viagens, negociacoes, atividades, ultimaInteracao, responsaveis, usuario, membro] = await Promise.all([
    buscarEtiquetas(cliente.id),
    buscarAnotacoes(cliente.id),
    listarViagensDoCliente(cliente.id),
    listarNegociacoesDoCliente(cliente.id),
    listarAtividadesDoCliente(cliente.id),
    buscarUltimaInteracao(cliente.id),
    listarMembros(),
    getUsuario(),
    getMembro(),
  ])
  const aplicadasIds = new Set(etiquetas.aplicadas.map((e) => e.id))
  const { futuras, passadas } = separarViagens(viagens, hojeNoBrasil())
  const agora = new Date().toISOString()

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{cliente.nome}</h1>
        <p className="text-sm text-tinta-suave">{textoUltimaInteracao(ultimaInteracao, hojeNoBrasil())}</p>
      </div>
      <ChamarWhatsapp
        key={`${cliente.nome}|${cliente.whatsapp}|${cliente.consentimento_whatsapp}`}
        clienteId={cliente.id}
        nome={cliente.nome}
        whatsapp={cliente.whatsapp}
        consentimento={cliente.consentimento_whatsapp}
      />
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <ClienteForm acao={salvarCliente.bind(null, cliente.id)} inicial={valoresDaLinha(cliente)} rotuloBotao="Salvar alterações" />
        <div className="flex max-w-xl flex-col gap-8 lg:max-w-none">
          <NegociacoesDoCliente clienteId={cliente.id} negociacoes={negociacoes} />
          <AtividadesCliente
            clienteId={cliente.id}
            agoraLocal={isoParaDataHoraLocal(agora)}
            responsaveis={responsaveis}
            negociacoes={negociacoes.map((n) => ({ id: n.id, titulo: n.titulo }))}
            atividades={atividades.map((a) => ({
              id: a.id, tipo: a.tipo, titulo: a.titulo, quando: formatarDataHora(a.feito_em ?? a.quando), status: a.status,
              responsavel: a.responsavel_nome, negociacao: a.negociacao_titulo, atrasada: atrasadaAgora(a.status, a.quando, agora),
              podeApagar: a.criado_por === usuario?.id || membro?.papel === 'dono',
            }))}
          />
          <HistoricoDeViagens futuras={futuras} passadas={passadas} todas={viagens} />
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
          <LinhaDoTempo
            itens={montarLinhaDoTempo(
              anotacoes.map((a) => ({ id: a.id, texto: a.texto, autor: a.autor_nome, criada_em: a.criada_em })),
              atividades.map((a) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo, quando: a.quando, status: a.status, feito_em: a.feito_em, responsavel_nome: a.responsavel_nome })),
            )}
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
