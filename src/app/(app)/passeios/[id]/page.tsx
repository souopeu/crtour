import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { PasseioForm } from '@/components/passeios/PasseioForm'
import { SaidaForm } from '@/components/passeios/SaidaForm'
import { SaidasDoPasseio } from '@/components/passeios/SaidasDoPasseio'
import { SaidasLoteForm } from '@/components/passeios/SaidasLoteForm'
import { PerguntasDoPasseio } from '@/components/perguntas/PerguntasDoPasseio'
import { getMembro } from '@/lib/auth/agencia'
import { hojeNoBrasil } from '@/lib/formato'
import { buscarPasseio, listarSaidas } from '@/lib/passeios/dados'
import { listarVeiculos } from '@/lib/veiculos/dados'
import { alterarSaidasLote, alternarArquivado, criarSaidasLote, excluirPasseio, salvarPasseio, salvarSaida } from '../actions'
import { Carregando } from '@/components/Carregando'

export const metadata = { title: 'Passeio' }

const ROTULO_SITUACAO = { aberta: 'Aberta', encerrada: 'Encerrada', cancelada: 'Cancelada' } as const

async function Conteudo({ params }: Pick<PageProps<'/passeios/[id]'>, 'params'>) {
  const { id } = await params
  const passeio = await buscarPasseio(id)
  if (!passeio) notFound()
  const [saidas, veiculos, membro] = await Promise.all([listarSaidas(passeio.id), listarVeiculos(), getMembro()])
  const nomeVeiculo = new Map(veiculos.map((v) => [v.id, v.nome]))
  await connection() // "today" is per request
  const hoje = hojeNoBrasil()

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[1.75rem] font-medium tracking-tight">{passeio.nome}</h1>
        {passeio.arquivado && <span className="rounded-full bg-superficie-suave px-3 py-1 text-sm">Arquivado</span>}
      </div>

      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="dados-titulo" className="flex flex-col gap-4">
          <h2 id="dados-titulo" className="text-lg font-semibold">Dados do passeio</h2>
          <PasseioForm
            acao={salvarPasseio.bind(null, passeio.id)}
            inicial={{ nome: passeio.nome, destino: passeio.destino ?? '', descricao: passeio.descricao ?? '', inclui: passeio.inclui ?? '', nao_inclui: passeio.nao_inclui ?? '' }}
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
            <SaidasDoPasseio
              acao={alterarSaidasLote.bind(null, passeio.id)}
              saidas={saidas.map((s) => ({
                id: s.id, data: s.data, horario: s.horario, reservadas: s.reservadas, capacidade: s.capacidade,
                preco_centavos: s.preco_centavos, futura: s.data >= hoje,
                veiculo: s.veiculo_id ? (nomeVeiculo.get(s.veiculo_id) ?? 'veículo arquivado') : null,
                situacao: s.situacao === 'aberta' && s.livres <= 0 ? 'Lotada' : ROTULO_SITUACAO[s.situacao],
              }))}
            />
          )}
          <h3 className="mt-2 font-semibold">Nova saída</h3>
          <SaidaForm
            acao={salvarSaida.bind(null, passeio.id, null)}
            inicial={{ data: '', capacidade: '', preco: '', situacao: 'aberta', horario: '', veiculo: '' }}
            veiculos={veiculos}
            rotuloBotao="Criar saída"
          />
          {!passeio.arquivado && (
            <SaidasLoteForm
              acao={criarSaidasLote.bind(null, passeio.id)}
              veiculos={veiculos}
              existentes={saidas.map((s) => ({ data: s.data, horario: s.horario }))}
              mostrarB2b={membro?.papel === 'dono'}
            />
          )}
        </section>
      </div>
      <PerguntasDoPasseio passeioId={passeio.id} />
    </div>
  )
}

export default function PasseioPage({ params }: PageProps<'/passeios/[id]'>) {
  return (
    <Suspense fallback={<Carregando altura="h-64" />}>
      <Conteudo params={params} />
    </Suspense>
  )
}
