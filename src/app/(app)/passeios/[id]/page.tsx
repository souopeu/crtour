import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { PasseioForm } from '@/components/passeios/PasseioForm'
import { SaidaForm } from '@/components/passeios/SaidaForm'
import { formatarDataBr } from '@/lib/formato'
import { buscarPasseio, listarSaidas } from '@/lib/passeios/dados'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { alternarArquivado, excluirPasseio, salvarPasseio, salvarSaida } from '../actions'

export const metadata = { title: 'Passeio' }

const ROTULO_SITUACAO = { aberta: 'Aberta', encerrada: 'Encerrada', cancelada: 'Cancelada' } as const

async function Conteudo({ params }: Pick<PageProps<'/passeios/[id]'>, 'params'>) {
  const { id } = await params
  const passeio = await buscarPasseio(id)
  if (!passeio) notFound()
  const saidas = await listarSaidas(passeio.id)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{passeio.nome}</h1>
        {passeio.arquivado && <span className="rounded-full bg-superficie-suave px-3 py-1 text-sm">Arquivado</span>}
      </div>

      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="dados-titulo" className="flex flex-col gap-4">
          <h2 id="dados-titulo" className="text-lg font-semibold">Dados do passeio</h2>
          <PasseioForm
            acao={salvarPasseio.bind(null, passeio.id)}
            inicial={{ nome: passeio.nome, destino: passeio.destino ?? '', descricao: passeio.descricao ?? '' }}
            rotuloBotao="Salvar alterações"
          />
          <form action={alternarArquivado.bind(null, passeio.id, !passeio.arquivado)}>
            <button type="submit" className="min-h-11 text-primaria underline">
              {passeio.arquivado ? 'Desarquivar passeio' : 'Arquivar passeio'}
            </button>
          </form>
          <ConfirmarExclusao
            acao={excluirPasseio.bind(null, passeio.id)}
            rotulo="Excluir passeio"
            aviso="Exclui o passeio. Só é possível se ele não tiver saídas; senão, arquive."
          />
        </section>

        <section aria-labelledby="saidas-titulo" className="flex flex-col gap-4">
          <h2 id="saidas-titulo" className="text-lg font-semibold">Saídas</h2>
          {saidas.length === 0 ? (
            <p className="text-sm text-tinta-suave">Nenhuma saída ainda. Crie a primeira abaixo.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {saidas.map((s) => (
                <li key={s.id}>
                  <Link href={`/saidas/${s.id}`} className="flex min-h-14 flex-col gap-1 rounded-[--radius-cartao] border border-linha bg-superficie p-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold">{formatarDataBr(s.data)}</span>
                    <span className="flex flex-wrap gap-x-3 text-sm text-tinta-suave">
                      <span>Vagas: {s.reservadas} / {s.capacidade}</span>
                      <span>{formatarReais(s.preco_centavos)} por pessoa</span>
                      <span className={s.situacao === 'cancelada' ? 'text-despesa' : ''}>{s.situacao === 'aberta' && s.livres <= 0 ? 'Lotada' : ROTULO_SITUACAO[s.situacao]}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-2 font-semibold">Nova saída</h3>
          <SaidaForm
            acao={salvarSaida.bind(null, passeio.id, null)}
            inicial={{ data: '', capacidade: '', preco: '', situacao: 'aberta' }}
            rotuloBotao="Criar saída"
          />
        </section>
      </div>
    </div>
  )
}

export default function PasseioPage({ params }: PageProps<'/passeios/[id]'>) {
  return (
    <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-64" />}>
      <Conteudo params={params} />
    </Suspense>
  )
}
