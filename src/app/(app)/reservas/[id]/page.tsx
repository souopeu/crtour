import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { PagamentoForm, TotalForm, VencimentoForm } from '@/components/pagamentos/PagamentoForms'
import { formatarDataBr, hojeNoBrasil } from '@/lib/formato'
import { diasAte, situacaoCobranca } from '@/lib/pagamentos/cobranca'
import { buscarReserva, listarPagamentos } from '@/lib/pagamentos/dados'
import { centavosParaCampo, formatarReais } from '@/lib/passeios/dinheiro'
import { estornarPagamento } from '../actions'
import { Carregando } from '@/components/Carregando'
import { VendidoPor } from '@/components/comissao/VendidoPor'
import { getMembro } from '@/lib/auth/agencia'
import { buscarVendedorDaReserva } from '@/lib/comissao/dados'
import { listarMembros } from '@/lib/negociacoes/dados'
import { VouchersReserva } from '@/components/vouchers/VouchersReserva'
import { reservaQuitada } from '@/lib/vouchers/voucher'

export const metadata = { title: 'Reserva' }

const TIPO = { sinal: 'Sinal', parcela: 'Parcela', saldo: 'Saldo', estorno: 'Estorno' } as const
const FORMA: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência', outro: 'Outro' }

function textoVencimento(vencimento: string | null, hoje: string) {
  if (!vencimento) return 'Sem vencimento definido'
  const d = diasAte(vencimento, hoje)
  if (d < 0) return `Vencido há ${-d} ${-d === 1 ? 'dia' : 'dias'} (${formatarDataBr(vencimento)})`
  if (d === 0) return `Vence hoje (${formatarDataBr(vencimento)})`
  return `Vence em ${d} ${d === 1 ? 'dia' : 'dias'} (${formatarDataBr(vencimento)})`
}

async function Conteudo({ params }: Pick<PageProps<'/reservas/[id]'>, 'params'>) {
  const { id } = await params
  const reserva = await buscarReserva(id)
  if (!reserva) notFound()
  const [pagamentos, vendedorId, membros, membro] = await Promise.all([listarPagamentos(reserva.id), buscarVendedorDaReserva(reserva.id), listarMembros(), getMembro()])
  const hoje = hojeNoBrasil()
  const ativa = reserva.situacao === 'ativa'
  const situacao = situacaoCobranca(reserva.saldo_centavos, reserva.vencimento_saldo, hoje)
  const rotuloSituacao = { quitada: 'Quitada', vencida: 'Vencida', a_vencer: 'Em aberto', sem_vencimento: 'Em aberto' }[situacao]

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <Link href={`/saidas/${reserva.saida_id}`} className="text-sm text-primaria underline">← {reserva.passeio_nome} · saída de {formatarDataBr(reserva.saida_data)}</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Reserva de <Link href={`/clientes/${reserva.cliente_id}`} className="text-primaria underline">{reserva.cliente_nome}</Link>
        </h1>
        <p className="text-tinta-suave">{reserva.qtd_pessoas} {reserva.qtd_pessoas === 1 ? 'pessoa' : 'pessoas'}</p>
        <VendidoPor reservaId={reserva.id} vendedorId={vendedorId} membros={membros} podeMudar={membro?.papel === 'dono'} />
        {!ativa && (
          <p role="note" className="mt-3 rounded-xl bg-alerta-suave p-3 text-sm text-alerta">
            Reserva cancelada.{reserva.pago_centavos > 0 && ` Há ${formatarReais(reserva.pago_centavos)} registrados como pagos: estorne os pagamentos se o dinheiro for devolvido.`}
          </p>
        )}
      </div>

      <section aria-labelledby="resumo-titulo" className="grid gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-4 sm:grid-cols-4">
        <h2 id="resumo-titulo" className="sr-only">Resumo financeiro</h2>
        <div><p className="text-sm text-tinta-suave">Total</p><p className="text-xl font-bold">{formatarReais(reserva.valor_total_centavos)}</p></div>
        <div><p className="text-sm text-tinta-suave">Pago</p><p className="text-xl font-bold text-receita">{formatarReais(reserva.pago_centavos)}</p></div>
        <div><p className="text-sm text-tinta-suave">Falta pagar</p><p className="text-xl font-bold">{formatarReais(Math.max(reserva.saldo_centavos, 0))}</p></div>
        <div>
          <p className="text-sm text-tinta-suave">Situação</p>
          <p className={`text-xl font-bold ${situacao === 'vencida' ? 'text-despesa' : situacao === 'quitada' ? 'text-receita' : ''}`}>{ativa ? rotuloSituacao : 'Cancelada'}</p>
          {ativa && situacao !== 'quitada' && <p className="text-sm text-tinta-suave">{textoVencimento(reserva.vencimento_saldo, hoje)}</p>}
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="pagamentos-titulo" className="flex flex-col gap-3">
          <h2 id="pagamentos-titulo" className="text-lg font-semibold">Pagamentos</h2>
          {pagamentos.length === 0 ? (
            <p className="text-sm text-tinta-suave">Nenhum pagamento registrado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pagamentos.map((p) => (
                <li key={p.id} className="flex flex-col gap-1 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {p.tipo === 'estorno' ? `Estorno −${formatarReais(p.valor_centavos)}` : formatarReais(p.valor_centavos)}
                    </span>
                    <span className="text-sm text-tinta-suave">{formatarDataBr(p.data)} · {TIPO[p.tipo]} · {FORMA[p.forma] ?? p.forma}</span>
                  </div>
                  {p.observacao && <p className="text-sm">{p.observacao}</p>}
                  {p.estornado && <p className="text-sm text-despesa">Estornado</p>}
                  {p.tipo !== 'estorno' && !p.estornado && (
                    <ConfirmarExclusao
                      acao={estornarPagamento.bind(null, reserva.id, p.id)}
                      rotulo="Estornar pagamento"
                      aviso={`Registra um estorno de ${formatarReais(p.valor_centavos)}. O pagamento original continua no histórico.`}
                      rotuloConfirmar="Estornar mesmo"
                      rotuloVoltar="Voltar"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-8">
          {ativa && <VouchersReserva reservaId={reserva.id} quitada={reservaQuitada(reserva)} />}
          {ativa ? (
            <>
              <section aria-labelledby="novo-pagamento-titulo" className="flex flex-col gap-3">
                <h2 id="novo-pagamento-titulo" className="text-lg font-semibold">Registrar pagamento</h2>
                {reserva.saldo_centavos > 0 ? (
                  <PagamentoForm reservaId={reserva.id} hoje={hoje} saldoSugerido={formatarReais(reserva.saldo_centavos)} />
                ) : (
                  <p className="text-sm text-tinta-suave">Reserva quitada: não há saldo a receber.</p>
                )}
              </section>
              <section aria-labelledby="vencimento-titulo" className="flex flex-col gap-3">
                <h2 id="vencimento-titulo" className="text-lg font-semibold">Vencimento e valor</h2>
                <VencimentoForm reservaId={reserva.id} atual={reserva.vencimento_saldo ?? ''} />
                <TotalForm reservaId={reserva.id} atual={centavosParaCampo(reserva.valor_total_centavos)} />
              </section>
            </>
          ) : (
            <p className="text-sm text-tinta-suave">Reserva cancelada: não aceita novos pagamentos.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ReservaPage({ params }: PageProps<'/reservas/[id]'>) {
  return (
    <Suspense fallback={<Carregando altura="h-64" />}>
      <Conteudo params={params} />
    </Suspense>
  )
}
