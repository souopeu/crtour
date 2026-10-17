import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { SaidaForm } from '@/components/passeios/SaidaForm'
import { formatarDataBr } from '@/lib/formato'
import { buscarSaida } from '@/lib/passeios/dados'
import { centavosParaCampo } from '@/lib/passeios/dinheiro'
import { excluirSaida, salvarSaida } from '../../passeios/actions'

export const metadata = { title: 'Saída' }

async function Conteudo({ params }: Pick<PageProps<'/saidas/[id]'>, 'params'>) {
  const { id } = await params
  const saida = await buscarSaida(id)
  if (!saida) notFound()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link href={`/passeios/${saida.passeio_id}`} className="text-sm text-primaria underline">← {saida.passeio_nome}</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Saída de {formatarDataBr(saida.data)}</h1>
        <p className="mt-1 text-tinta-suave">Vagas: 0 reservadas de {saida.capacidade}. As reservas chegam na próxima etapa.</p>
      </div>
      <SaidaForm
        acao={salvarSaida.bind(null, saida.passeio_id, saida.id)}
        inicial={{ data: saida.data, capacidade: String(saida.capacidade), preco: centavosParaCampo(saida.preco_centavos), situacao: saida.situacao }}
        rotuloBotao="Salvar alterações"
        mostrarSituacao
      />
      <ConfirmarExclusao
        acao={excluirSaida.bind(null, saida.passeio_id, saida.id)}
        rotulo="Excluir saída"
        aviso="Exclui esta saída. Se ela já tiver reservas, cancele em vez de excluir."
      />
    </div>
  )
}

export default function SaidaPage({ params }: PageProps<'/saidas/[id]'>) {
  return (
    <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-64" />}>
      <Conteudo params={params} />
    </Suspense>
  )
}
