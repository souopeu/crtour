import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { BotaoImprimir } from '@/components/BotaoImprimir'
import { formatarDataBr, ouTraco } from '@/lib/formato'
import { buscarSaida, listarPassageirosDaSaida } from '@/lib/passeios/dados'
import { montarLista } from '@/lib/passageiros/lista'
import { Carregando } from '@/components/Carregando'
import { EstadoVazio } from '@/components/tela/EstadoVazio'

export const metadata = { title: 'Lista de passageiros' }

async function Conteudo({ params }: Pick<PageProps<'/saidas/[id]/passageiros'>, 'params'>) {
  const { id } = await params
  const saida = await buscarSaida(id)
  if (!saida) notFound()
  const { reservas, passageiros } = await listarPassageirosDaSaida(saida.id)
  const linhas = montarLista(reservas, passageiros)
  const semNome = linhas.filter((l) => l.semNome).length

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="print:hidden">
        <Link href={`/saidas/${saida.id}`} className="text-sm text-primaria underline">← Voltar para a saída</Link>
      </div>
      <header>
        <h1 className="text-[1.75rem] font-medium tracking-tight">Lista de passageiros</h1>
        <p className="text-tinta-suave print:text-black">{saida.passeio_nome} · saída de {formatarDataBr(saida.data)}</p>
        <p className="mt-1" aria-live="polite">
          <strong>{linhas.length}</strong> {linhas.length === 1 ? 'passageiro' : 'passageiros'} de {saida.capacidade} vagas
          {semNome > 0 && <span> · {semNome} {semNome === 1 ? 'nome a informar' : 'nomes a informar'}</span>}
        </p>
      </header>
      <div className="flex flex-wrap items-center gap-4 print:hidden">
        <BotaoImprimir />
        <a href={`/saidas/${saida.id}/passageiros/csv`} className="inline-flex min-h-12 items-center text-primaria underline">Baixar em planilha (.csv)</a>
      </div>

      {linhas.length === 0 ? (
        <EstadoVazio acoes={[{ href: `/saidas/${saida.id}`, rotulo: 'Reservar nesta saída' }]}>Esta saída ainda não tem reservas ativas.</EstadoVazio>
      ) : (
        <table className="w-full border-collapse text-left text-base">
          <thead>
            <tr className="border-b-2 border-tinta">
              <th className="w-12 py-2 pr-2">Nº</th>
              <th className="py-2 pr-2">Nome</th>
              <th className="py-2 pr-2">Tipo</th>
              <th className="py-2 pr-2">WhatsApp</th>
              <th className="py-2">Reserva</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.numero} className="border-b border-linha break-inside-avoid">
                <td className="py-2 pr-2">{l.numero}</td>
                <td className={`py-2 pr-2 ${l.semNome ? 'italic text-tinta-suave print:text-black' : 'font-medium'}`}>{l.nome}</td>
                <td className="py-2 pr-2">{l.tipo}</td>
                <td className="py-2 pr-2">{ouTraco(l.telefone)}</td>
                <td className="py-2">{ouTraco(l.reserva)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function PassageirosPage({ params }: PageProps<'/saidas/[id]/passageiros'>) {
  return (
    <Suspense fallback={<Carregando altura="h-64" />}>
      <Conteudo params={params} />
    </Suspense>
  )
}
