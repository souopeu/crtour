import Link from 'next/link'
import { formatarDataBr } from '@/lib/formato'
import { saldoEmAberto, type Viagem } from '@/lib/clientes/viagens'
import { formatarReais } from '@/lib/passeios/dinheiro'

function Linha({ v }: { v: Viagem }) {
  const cancelada = v.situacao === 'cancelada'
  return (
    <li>
      <Link href={`/reservas/${v.reservaId}`} className="flex flex-col gap-1 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">{v.passeio}</span>
          <span className="text-sm text-tinta-suave">{formatarDataBr(v.saidaData)}</span>
        </span>
        <span className="text-sm text-tinta-suave">
          {v.papel === 'Acompanhante' ? 'Como acompanhante' : `${v.qtd} ${v.qtd === 1 ? 'pessoa' : 'pessoas'}`}
          {cancelada && <strong className="ml-2 text-despesa">Cancelada</strong>}
        </span>
        {v.papel === 'Responsável' && !cancelada && (
          <span className="text-sm">
            Pago {formatarReais(v.pago)} · {v.saldo > 0 ? <strong>falta {formatarReais(v.saldo)}</strong> : <strong className="text-receita">quitada</strong>}
          </span>
        )}
      </Link>
    </li>
  )
}

export function HistoricoDeViagens({ futuras, passadas, todas }: { futuras: Viagem[]; passadas: Viagem[]; todas: Viagem[] }) {
  const devendo = saldoEmAberto(todas)
  return (
    <section aria-labelledby="viagens-titulo" className="flex w-full flex-col gap-3">
      <h2 id="viagens-titulo" className="text-lg font-semibold">Viagens</h2>
      {todas.length === 0 ? (
        <p className="text-sm text-tinta-suave">Nenhuma viagem registrada para este cliente.</p>
      ) : (
        <>
          <p aria-live="polite" className={devendo > 0 ? 'font-semibold' : 'text-sm text-tinta-suave'}>
            {devendo > 0 ? <>Saldo em aberto: {formatarReais(devendo)}. <Link href="/cobrancas" className="font-normal text-primaria underline">Ver cobranças</Link></> : 'Nenhum saldo em aberto.'}
          </p>
          {futuras.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-tinta-suave">Próximas</h3>
              <ul className="flex flex-col gap-2">{futuras.map((v) => <Linha key={v.reservaId} v={v} />)}</ul>
            </div>
          )}
          {passadas.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-tinta-suave">Já viajou</h3>
              <ul className="flex flex-col gap-2">{passadas.map((v) => <Linha key={v.reservaId} v={v} />)}</ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
