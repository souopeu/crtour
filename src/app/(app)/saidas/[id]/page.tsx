import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { SaidaForm } from '@/components/passeios/SaidaForm'
import { Acompanhantes } from '@/components/reservas/Acompanhantes'
import { ReservaForm } from '@/components/reservas/ReservaForm'
import { formatarWhatsapp } from '@/lib/clientes/rotulos'
import { formatarDataBr } from '@/lib/formato'
import { buscarClientesParaReserva, buscarNomeDoCliente, buscarSaida, listarReservas } from '@/lib/passeios/dados'
import { centavosParaCampo, formatarReais } from '@/lib/passeios/dinheiro'
import { excluirSaida, salvarSaida } from '../../passeios/actions'
import { cancelarReserva } from '../actions'

export const metadata = { title: 'Saída' }

const um = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

async function Conteudo({ params, searchParams }: Pick<PageProps<'/saidas/[id]'>, 'params' | 'searchParams'>) {
  const { id } = await params
  const sp = await searchParams
  const saida = await buscarSaida(id)
  if (!saida) notFound()

  const busca = um(sp.busca).trim().slice(0, 100)
  const clienteEscolhido = um(sp.cliente)
  const [reservas, resultados, nomeEscolhido] = await Promise.all([
    listarReservas(saida.id),
    busca ? buscarClientesParaReserva(busca) : Promise.resolve([]),
    clienteEscolhido ? buscarNomeDoCliente(clienteEscolhido) : Promise.resolve(null),
  ])
  const lotada = saida.livres <= 0
  const podeReservar = saida.situacao === 'aberta' && !lotada
  const href = (extra: Record<string, string>) => `/saidas/${saida.id}?${new URLSearchParams({ ...(busca ? { busca } : {}), ...extra })}`

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <Link href={`/passeios/${saida.passeio_id}`} className="text-sm text-primaria underline">← {saida.passeio_nome}</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Saída de {formatarDataBr(saida.data)}</h1>
        <p className="mt-1 text-tinta-suave" aria-live="polite">
          Vagas: {saida.reservadas} reservadas de {saida.capacidade} · {Math.max(saida.livres, 0)} livres
          {lotada && saida.situacao === 'aberta' && <strong className="ml-2 text-alerta">Lotada</strong>}
          {saida.situacao !== 'aberta' && <strong className="ml-2">{saida.situacao === 'cancelada' ? 'Cancelada' : 'Encerrada'}</strong>}
        </p>
        <Link href={`/saidas/${saida.id}/passageiros`} className="mt-2 inline-flex min-h-11 items-center text-primaria underline">Lista de passageiros (imprimir)</Link>
        {sp.feito === '1' && <p role="status" className="mt-3 w-fit rounded-xl bg-receita-suave p-3 text-sm text-receita">Reserva feita.</p>}
      </div>

      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-8">
          <section aria-labelledby="reservas-titulo" className="flex flex-col gap-3">
            <h2 id="reservas-titulo" className="text-lg font-semibold">Reservas</h2>
            {reservas.length === 0 ? (
              <p className="text-sm text-tinta-suave">Nenhuma reserva ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {reservas.map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link href={`/clientes/${r.cliente_id}`} className="font-semibold text-primaria underline">{r.cliente_nome}</Link>
                      <span className={`text-sm ${r.situacao === 'cancelada' ? 'text-despesa' : 'text-receita'}`}>
                        {r.situacao === 'cancelada' ? 'Cancelada' : 'Ativa'}
                      </span>
                    </div>
                    <p className="text-sm text-tinta-suave">
                      {r.qtd_pessoas} {r.qtd_pessoas === 1 ? 'pessoa' : 'pessoas'} · {formatarReais(r.valor_total_centavos)}
                    </p>
                    {r.observacao && <p className="text-sm">{r.observacao}</p>}
                    {r.situacao === 'ativa' && (
                      <Acompanhantes
                        saidaId={saida.id}
                        reservaId={r.id}
                        passageiros={r.passageiros.map((p) => ({ id: p.id, nome: p.nome, telefone: formatarWhatsapp(p.whatsapp) }))}
                        lugaresLivres={r.qtd_pessoas - 1 - r.passageiros.length}
                      />
                    )}
                    {r.situacao === 'ativa' && (
                      <ConfirmarExclusao
                        acao={cancelarReserva.bind(null, saida.id, r.id)}
                        rotulo="Cancelar reserva"
                        aviso={`Cancela a reserva de ${r.cliente_nome} e devolve ${r.qtd_pessoas} ${r.qtd_pessoas === 1 ? 'vaga' : 'vagas'} à saída. O registro continua no histórico.`}
                        rotuloConfirmar="Cancelar reserva mesmo"
                        rotuloVoltar="Voltar"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="nova-reserva-titulo" className="flex flex-col gap-3">
            <h2 id="nova-reserva-titulo" className="text-lg font-semibold">Nova reserva</h2>
            {!podeReservar ? (
              <p className="text-sm text-tinta-suave">
                {saida.situacao !== 'aberta' ? 'Esta saída não está aberta para reservas.' : 'Saída lotada: cancele uma reserva para abrir vaga.'}
              </p>
            ) : nomeEscolhido ? (
              <>
                <p>Reserva para <strong>{nomeEscolhido}</strong>. <Link href={href({})} className="text-primaria underline">Escolher outro cliente</Link></p>
                <ReservaForm saidaId={saida.id} clienteId={clienteEscolhido} vagasLivres={saida.livres} precoPorPessoa={formatarReais(saida.preco_centavos)} />
              </>
            ) : (
              <>
                <form method="get" action={`/saidas/${saida.id}`} role="search" className="flex flex-col gap-2">
                  <label htmlFor="busca" className="text-sm font-medium">Buscar cliente (nome, e-mail ou telefone)</label>
                  <div className="flex gap-2">
                    <input id="busca" name="busca" type="search" defaultValue={busca} maxLength={100}
                      className="h-12 min-w-0 flex-1 rounded-xl border border-controle bg-superficie px-3 text-base" />
                    <button type="submit" className="min-h-12 rounded-full bg-destaque px-6 font-semibold text-destaque-texto">Buscar</button>
                  </div>
                </form>
                {busca && resultados.length === 0 && <p className="text-sm text-tinta-suave">Nenhum cliente encontrado. <Link href="/clientes/novo" className="text-primaria underline">Cadastrar novo cliente</Link></p>}
                {resultados.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {resultados.map((c) => (
                      <li key={c.id}>
                        <Link href={href({ cliente: c.id })} className="flex min-h-12 items-center justify-between gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
                          <span className="font-semibold">{c.nome}</span>
                          <span className="text-sm text-tinta-suave">{c.cidade ?? ''} · Escolher</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>

        <section aria-labelledby="dados-titulo" className="flex flex-col gap-4">
          <h2 id="dados-titulo" className="text-lg font-semibold">Dados da saída</h2>
          <SaidaForm
            acao={salvarSaida.bind(null, saida.passeio_id, saida.id)}
            inicial={{ data: saida.data, capacidade: String(saida.capacidade), preco: centavosParaCampo(saida.preco_centavos), situacao: saida.situacao }}
            rotuloBotao="Salvar alterações"
            mostrarSituacao
          />
          <ConfirmarExclusao
            acao={excluirSaida.bind(null, saida.passeio_id, saida.id)}
            rotulo="Excluir saída"
            aviso="Exclui esta saída. Se ela já tiver reservas, cancele a saída em vez de excluir."
          />
        </section>
      </div>
    </div>
  )
}

export default function SaidaPage({ params, searchParams }: PageProps<'/saidas/[id]'>) {
  return (
    <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-64" />}>
      <Conteudo params={params} searchParams={searchParams} />
    </Suspense>
  )
}
