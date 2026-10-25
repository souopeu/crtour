import Link from 'next/link'
import { Suspense } from 'react'
import { moverReserva } from '@/app/(app)/reservas/actions'
import { Carregando } from '@/components/Carregando'
import { ChipStatus } from '@/components/reservas/ChipStatus'
import { MoverReserva } from '@/components/reservas/MoverReserva'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { botaoSecundario, campoBarra, cartaoFiltros } from '@/components/tela/estilos'
import { formatarDataBr, hojeNoBrasil } from '@/lib/formato'
import { saidasDoDia, saidasDosPasseios, type SaidaDoDia } from '@/lib/operacao/dados'
import { destinosParaMover, lerDia, ocupacao } from '@/lib/operacao/operacao'
import { somarDias } from '@/lib/periodo/periodo'

export const metadata = { title: 'Saídas do dia' }

const DIAS = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' })
const diaDaSemana = (iso: string) => DIAS.format(new Date(`${iso}T12:00:00Z`))

function SeletorDeDia({ dia, hoje }: { dia: string; hoje: string }) {
  const seta = 'inline-flex size-11 items-center justify-center rounded-lg border border-controle bg-superficie hover:bg-superficie-suave'
  return (
    <section aria-label="Escolher o dia" className={cartaoFiltros}>
      <div className="flex flex-wrap items-end gap-2">
        <Link href={`/operacao?dia=${somarDias(dia, -1)}`} className={seta} aria-label="Dia anterior">‹</Link>
        <form method="get" action="/operacao" className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-tinta-suave">Data das saídas</span>
            <input type="date" name="dia" defaultValue={dia} className={campoBarra} />
          </label>
          <button type="submit" className={botaoSecundario}>Ver</button>
        </form>
        <Link href={`/operacao?dia=${somarDias(dia, 1)}`} className={seta} aria-label="Próximo dia">›</Link>
        <Link href="/operacao" aria-current={dia === hoje ? 'page' : undefined}
          className="inline-flex min-h-11 items-center rounded-lg border border-controle bg-superficie px-4 text-sm aria-[current=page]:border-marca aria-[current=page]:bg-marca aria-[current=page]:font-semibold aria-[current=page]:text-white">
          Hoje
        </Link>
      </div>
      <p className="text-sm text-tinta-suave">{formatarDataBr(dia)}, {diaDaSemana(dia)}{dia === hoje ? ' (hoje)' : ''}</p>
    </section>
  )
}

function CartaoSaida({ s, destinos, hoje }: { s: SaidaDoDia; destinos: Awaited<ReturnType<typeof saidasDosPasseios>>; hoje: string }) {
  const pct = ocupacao(s.reservadas, s.capacidade)
  return (
    <article aria-labelledby={`saida-${s.id}`} className="flex flex-col gap-3 rounded-(--radius-cartao) border border-linha bg-superficie p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-lg font-semibold tabular-nums">{s.horario ? s.horario.slice(0, 5) : 'Sem horário'}</p>
          <h2 id={`saida-${s.id}`} className="font-semibold"><Link href={`/saidas/${s.id}`} className="text-primaria underline">{s.passeio}</Link></h2>
          <p className="text-sm text-tinta-suave">{s.veiculo ? `${s.veiculo.nome} · ${s.veiculo.lugares} lugares` : 'Sem veículo'}</p>
        </div>
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${s.situacao === 'aberta' ? 'bg-primaria-suave text-primaria' : 'bg-superficie-suave text-tinta'}`}>
          {s.situacao === 'aberta' ? 'Aberta' : 'Vendas encerradas'}
        </span>
      </header>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-sm"><span>{s.reservadas} / {s.capacidade} lugares</span><span className={s.livres > 0 ? 'text-receita' : 'text-alerta'}>{Math.max(s.livres, 0)} livres</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-superficie-suave" role="img" aria-label={`Ocupação de ${pct}%`}>
          <div className="h-full rounded-full bg-marca" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {s.reservas.length === 0 ? (
        <p className="text-sm text-tinta-suave">Nenhuma reserva nesta saída.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-linha border-t border-linha">
          {s.reservas.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/reservas/${r.id}`} className="font-medium text-primaria underline">{r.clienteNome}</Link>
                <span className="flex items-center gap-2 text-sm">{r.pessoas} {r.pessoas === 1 ? 'pessoa' : 'pessoas'} <ChipStatus status={r.status} /></span>
              </div>
              <MoverReserva compacto acao={moverReserva.bind(null, r.id)} destinos={destinosParaMover(destinos, s.id, s.passeioId, r.pessoas, hoje)} />
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

async function Conteudo({ searchParams }: Pick<PageProps<'/operacao'>, 'searchParams'>) {
  const params = await searchParams // read the request first, so "today" is computed per request (not at build time)
  const hoje = hojeNoBrasil()
  const dia = lerDia(params.dia, hoje)
  const saidas = await saidasDoDia(dia)
  const destinos = await saidasDosPasseios([...new Set(saidas.map((s) => s.passeioId))], hoje)
  const lugares = saidas.reduce((t, s) => t + Math.max(s.livres, 0), 0)
  return (
    <>
      <SeletorDeDia dia={dia} hoje={hoje} />
      {saidas.length === 0 ? (
        <EstadoVazio acoes={[{ href: '/passeios', rotulo: 'Ver passeios e criar saídas' }]}>Nenhuma saída neste dia.</EstadoVazio>
      ) : (
        <>
          <p aria-live="polite" className="text-sm text-tinta-suave">{saidas.length} {saidas.length === 1 ? 'saída' : 'saídas'} · {lugares} {lugares === 1 ? 'lugar livre' : 'lugares livres'}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {saidas.map((s) => <CartaoSaida key={s.id} s={s} destinos={destinos} hoje={hoje} />)}
          </div>
        </>
      )}
    </>
  )
}

export default function OperacaoPage({ searchParams }: PageProps<'/operacao'>) {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4">
      <CabecalhoPagina area="Operação" titulo="Saídas do dia" descricao="Os passeios do dia, com veículo, lugares e as reservas de cada saída." />
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </section>
  )
}
