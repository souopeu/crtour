import Link from 'next/link'
import { Suspense } from 'react'
import { formatarDataHora } from '@/lib/formato'
import { textoDoAviso } from '@/lib/avisos/avisos'
import { listarAvisos } from '@/lib/negociacoes/dados'
import { marcarAvisoLido, marcarTodosLidos } from './actions'
import { Carregando } from '@/components/Carregando'
import { EstadoVazio } from '@/components/tela/EstadoVazio'

export const metadata = { title: 'Avisos' }

// R128, R130: everyone sees their own notices and reminders; the owner also sees the agency-wide ones.
async function Lista() {
  const avisos = await listarAvisos()
  const naoLidos = avisos.filter((a) => !a.lido_em).length
  if (avisos.length === 0) {
    return <EstadoVazio acoes={[{ href: '/hoje', rotulo: 'Abrir o Hoje' }]}>Nenhum aviso ainda. Lembretes de atividades, cobranças que vencem, saídas chegando, vendas fechadas e contatos do formulário aparecem aqui.</EstadoVazio>
  }
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-tinta-suave">{naoLidos === 0 ? 'Tudo lido.' : `${naoLidos} ${naoLidos === 1 ? 'aviso novo' : 'avisos novos'}`}</p>
        {naoLidos > 0 && (
          <form action={marcarTodosLidos}><button type="submit" className="min-h-11 text-primaria underline">Marcar todos como lidos</button></form>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {avisos.map((a) => {
          const t = textoDoAviso(a)
          return (
            <li key={a.id} className={`flex flex-col gap-1 rounded-[--radius-cartao] border p-4 ${a.lido_em ? 'border-linha bg-superficie' : 'border-primaria bg-primaria-suave'}`}>
              <p className="font-semibold">
                {!a.lido_em && <span className="mr-2 rounded-full bg-primaria px-2 py-0.5 text-xs font-bold text-white">Novo</span>}
                {t.titulo}
              </p>
              <p className="text-sm">{t.detalhe}</p>
              <p className="text-sm text-tinta-suave">{formatarDataHora(a.criado_em)}</p>
              <div className="flex flex-wrap items-center gap-4">
                {t.href && <Link href={t.href} className="inline-flex min-h-11 items-center text-primaria underline">Abrir</Link>}
                {!a.lido_em && (
                  <form action={marcarAvisoLido.bind(null, a.id)}><button type="submit" className="min-h-11 underline">Marcar como lido</button></form>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export default function AvisosPage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-[1.75rem] font-medium tracking-tight">Avisos</h1>
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Lista />
      </Suspense>
    </section>
  )
}
