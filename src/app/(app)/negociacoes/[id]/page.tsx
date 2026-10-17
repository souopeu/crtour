import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { NegociacaoForm } from '@/components/negociacoes/NegociacaoForm'
import { formatarDataHora, formatarDataBr } from '@/lib/formato'
import { buscarNegociacao, listarEventos, listarMembros, listarSaidasParaSelecao } from '@/lib/negociacoes/dados'
import { rotuloDaEtapa, rotuloDoMotivo } from '@/lib/negociacoes/negociacoes'
import { centavosParaCampo, formatarReais } from '@/lib/passeios/dinheiro'
import { atualizarNegociacao } from '../actions'

export const metadata = { title: 'Negociação' }

async function Conteudo({ params }: Pick<PageProps<'/negociacoes/[id]'>, 'params'>) {
  const { id } = await params
  const n = await buscarNegociacao(id)
  if (!n) notFound()
  const [eventos, responsaveis, saidas] = await Promise.all([listarEventos(n.id), listarMembros(), listarSaidasParaSelecao()])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <Link href="/funil" className="text-sm text-primaria underline">← Funil</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{n.titulo}</h1>
        <p className="text-tinta-suave">
          Cliente: <Link href={`/clientes/${n.cliente_id}`} className="text-primaria underline">{n.cliente_nome}</Link> · {rotuloDaEtapa(n.etapa)} · {n.probabilidade}%
        </p>
        {n.etapa === 'perdido' && n.motivo_perda && (
          <p className="mt-1 text-despesa">Motivo da perda: {rotuloDoMotivo(n.motivo_perda)}{n.motivo_texto ? ` (${n.motivo_texto})` : ''}</p>
        )}
        <p className="mt-1 text-lg">
          Valor {formatarReais(n.valor_centavos)} · <strong>previsto {formatarReais(n.valor_previsto_centavos)}</strong>
          {n.fechado_em && <span className="ml-2 text-sm text-receita">Fechada em {formatarDataBr(n.fechado_em)}</span>}
        </p>
      </div>
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="dados-titulo" className="flex flex-col gap-4">
          <h2 id="dados-titulo" className="text-lg font-semibold">Dados da negociação</h2>
          <NegociacaoForm
            acao={atualizarNegociacao.bind(null, n.id)}
            inicial={{
              titulo: n.titulo, valor: n.valor_centavos === 0 ? '' : centavosParaCampo(n.valor_centavos), etapa: n.etapa,
              probabilidade: String(n.probabilidade), responsavel: n.responsavel_id ?? '', dataEsperada: n.data_fechamento_esperada ?? '', saida: n.saida_id ?? '',
              motivo: n.motivo_perda ?? '', motivoTexto: n.motivo_texto ?? '',
            }}
            rotuloBotao="Salvar alterações"
            responsaveis={responsaveis}
            saidas={saidas}
          />
        </section>
        <section aria-labelledby="historico-titulo" className="flex flex-col gap-3">
          <h2 id="historico-titulo" className="text-lg font-semibold">Histórico de etapas</h2>
          <ol className="flex flex-col gap-2">
            {eventos.map((e) => (
              <li key={e.id} className="rounded-[--radius-cartao] border border-linha bg-superficie p-3 text-sm">
                <strong>{e.de ? `${rotuloDaEtapa(e.de)} → ${rotuloDaEtapa(e.para)}` : `Criada em ${rotuloDaEtapa(e.para)}`}</strong>
                {e.motivo && <span className="block text-despesa">Motivo: {rotuloDoMotivo(e.motivo)}</span>}
                <span className="block text-tinta-suave">{formatarDataHora(e.em)}{e.por_nome ? ` · ${e.por_nome}` : ''}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}

export default function NegociacaoPage({ params }: PageProps<'/negociacoes/[id]'>) {
  return (
    <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-64" />}>
      <Conteudo params={params} />
    </Suspense>
  )
}
