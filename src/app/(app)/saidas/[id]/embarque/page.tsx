import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { IniciarEmbarque } from '@/components/embarque/IniciarEmbarque'
import { LugarEmbarque } from '@/components/embarque/LugarEmbarque'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { lugaresDasSaidas } from '@/lib/embarque/dados'
import { contarEmbarque } from '@/lib/embarque/embarque'
import { formatarDataBr } from '@/lib/formato'
import { listarMembros } from '@/lib/negociacoes/dados'
import { buscarSaida } from '@/lib/passeios/dados'
import { iniciarEmbarque, marcarEmbarque } from '../../embarque-actions'

export const metadata = { title: 'Embarque' }

async function Conteudo({ params }: Pick<PageProps<'/saidas/[id]/embarque'>, 'params'>) {
  const { id } = await params
  const saida = await buscarSaida(id)
  if (!saida) notFound()
  const [porSaida, membros] = await Promise.all([lugaresDasSaidas([saida.id]), listarMembros()])
  const lugares = porSaida.get(saida.id) ?? []
  const { embarcados, total } = contarEmbarque(lugares)
  const nomeMembro = new Map(membros.map((m) => [m.user_id, m.nome]))
  const descricao = `${saida.passeio_nome} · ${formatarDataBr(saida.data)}${saida.horario ? ` · ${saida.horario.slice(0, 5)}` : ''}`

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link href={`/saidas/${saida.id}`} className="w-fit text-sm text-primaria underline">← Saída de {formatarDataBr(saida.data)}</Link>
      <CabecalhoPagina area="Operação" titulo="Embarque" descricao={descricao} />
      {saida.situacao === 'cancelada' ? (
        <p className="rounded-(--radius-cartao) border border-linha bg-superficie p-4">Esta saída foi cancelada: não há embarque.</p>
      ) : total === 0 ? (
        <EstadoVazio acoes={[{ href: `/saidas/${saida.id}`, rotulo: 'Ver a saída' }]}>Nenhuma reserva ativa nesta saída.</EstadoVazio>
      ) : !saida.embarque_iniciado_em ? (
        <div className="flex flex-col gap-2 rounded-(--radius-cartao) border border-linha bg-superficie p-4">
          <p>{total} {total === 1 ? 'pessoa' : 'pessoas'} para embarcar. Ao iniciar, as reservas prontas passam para <strong>Em execução</strong>.</p>
          <IniciarEmbarque acao={iniciarEmbarque.bind(null, saida.id)} />
        </div>
      ) : (
        <>
          <p aria-live="polite" className="text-lg font-semibold tabular-nums">{embarcados} de {total} embarcados</p>
          <ul aria-label="Lista de presença" className="flex flex-col gap-2">
            {lugares.map((l) => (
              <li key={l.chave}>
                <LugarEmbarque
                  acao={marcarEmbarque.bind(null, saida.id, l.reservaId)}
                  nome={l.nome}
                  detalhe={l.tipo === 'Responsável' ? 'Responsável pela reserva' : `Acompanhante de ${l.responsavel}`}
                  passageiroId={l.passageiroId}
                  vaga={l.vaga}
                  embarcouEm={l.embarque?.em ?? null}
                  marcadoPor={l.embarque?.por ? (nomeMembro.get(l.embarque.por) ?? null) : null}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export default function EmbarquePage({ params }: PageProps<'/saidas/[id]/embarque'>) {
  return (
    <Suspense fallback={<Carregando altura="h-40" />}>
      <Conteudo params={params} />
    </Suspense>
  )
}
