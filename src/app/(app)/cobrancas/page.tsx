import Link from 'next/link'
import { Suspense } from 'react'
import { formatarDataBr, hojeNoBrasil } from '@/lib/formato'
import { estadoDoBotao, linkWhatsapp } from '@/lib/clientes/whatsappLink'
import { FILTROS_COBRANCA, diasAte, mensagemCobranca, type FiltroCobranca } from '@/lib/pagamentos/cobranca'
import { listarCobrancas } from '@/lib/pagamentos/dados'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { Carregando } from '@/components/Carregando'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { AbasDeVisao } from '@/components/tela/AbasDeVisao'

export const metadata = { title: 'Cobranças' }

const ROTULO: Record<FiltroCobranca, string> = {
  todas: 'Todas', vencidas: 'Vencidas', proximos7: 'Vencem em 7 dias', sem_vencimento: 'Sem vencimento',
}

function textoVencimento(vencimento: string | null, hoje: string) {
  if (!vencimento) return { texto: 'Sem vencimento', vencida: false }
  const d = diasAte(vencimento, hoje)
  if (d < 0) return { texto: `Vencida há ${-d} ${-d === 1 ? 'dia' : 'dias'} (${formatarDataBr(vencimento)})`, vencida: true }
  if (d === 0) return { texto: `Vence hoje (${formatarDataBr(vencimento)})`, vencida: false }
  return { texto: `Vence em ${d} ${d === 1 ? 'dia' : 'dias'} (${formatarDataBr(vencimento)})`, vencida: false }
}

async function Lista({ searchParams }: Pick<PageProps<'/cobrancas'>, 'searchParams'>) {
  const bruto = (await searchParams).filtro
  const filtro = (FILTROS_COBRANCA as readonly string[]).includes(String(bruto)) ? (bruto as FiltroCobranca) : 'todas'
  const hoje = hojeNoBrasil()
  const cobrancas = await listarCobrancas(filtro, hoje)
  const totalEmAberto = cobrancas.reduce((soma, c) => soma + c.saldo, 0)

  return (
    <>
      <AbasDeVisao rotulo="Filtros das cobranças" abas={FILTROS_COBRANCA.map((f) => (
        { rotulo: ROTULO[f], href: f === 'todas' ? '/cobrancas' : `/cobrancas?filtro=${f}`, ativa: f === filtro }
      ))} />
      <p aria-live="polite" className="text-sm text-tinta-suave">
        {cobrancas.length === 0 ? 'Nada a receber neste filtro.' : <>{cobrancas.length} {cobrancas.length === 1 ? 'reserva' : 'reservas'} · <strong>{formatarReais(totalEmAberto)}</strong> a receber</>}
      </p>
      {cobrancas.length === 0 && (
        <EstadoVazio compacto acoes={[{ href: '/passeios', rotulo: 'Ver passeios' }]}>As cobranças aparecem quando uma reserva tem saldo em aberto.</EstadoVazio>
      )}
      <ul className="grid gap-3 lg:grid-cols-2">
        {cobrancas.map((c) => {
          const venc = textoVencimento(c.vencimento, hoje)
          const botao = estadoDoBotao(c.clienteWhatsapp, c.consentimento)
          const link = botao.habilitado
            ? linkWhatsapp(c.clienteWhatsapp, mensagemCobranca({ nome: c.clienteNome, saldoCentavos: c.saldo, vencimento: c.vencimento, passeio: c.passeio, dataSaida: c.saidaData }))
            : null
          return (
            <li key={c.reservaId} className={`flex flex-col gap-2 rounded-(--radius-cartao) border border-l-4 border-linha bg-superficie p-4 ${venc.vencida ? 'border-l-despesa' : 'border-l-primaria'}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/clientes/${c.clienteId}`} className="text-lg font-semibold text-primaria underline">{c.clienteNome}</Link>
                <span className={venc.vencida ? 'font-semibold text-despesa' : 'text-tinta-suave'}>{venc.texto}</span>
              </div>
              <p className="text-sm text-tinta-suave">{c.passeio} · saída de {formatarDataBr(c.saidaData)}</p>
              <p>
                Falta <strong>{formatarReais(c.saldo)}</strong>{' '}
                <span className="text-sm text-tinta-suave">(total {formatarReais(c.total)}, pago {formatarReais(c.pago)})</span>
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link href={`/reservas/${c.reservaId}`} className="inline-flex min-h-11 items-center text-primaria underline">Ver reserva e pagamentos</Link>
                {link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-destaque px-5 font-semibold text-destaque-texto">Cobrar no WhatsApp</a>
                ) : (
                  <span className="text-sm text-despesa">
                    {botao.habilitado ? 'Sem WhatsApp cadastrado.' : botao.motivo === 'pediu_saida' ? 'Pediu para não receber mensagens.' : 'Sem WhatsApp cadastrado.'}
                  </span>
                )}
              </div>
              {link && botao.habilitado && botao.aviso === 'sem_consentimento' && (
                <p className="text-sm text-tinta-suave">Consentimento de mensagens não informado: este é um contato sobre uma reserva existente, não promoção.</p>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

export default function CobrancasPage({ searchParams }: PageProps<'/cobrancas'>) {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Cobranças</h1>
        <p className="text-sm text-tinta-suave">Reservas ativas com saldo a receber, das mais urgentes para as menos.</p>
      </div>
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </section>
  )
}
