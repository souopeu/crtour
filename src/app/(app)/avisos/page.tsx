import Link from 'next/link'
import { Suspense } from 'react'
import { getMembro } from '@/lib/auth/agencia'
import { formatarDataHora } from '@/lib/formato'
import { listarAvisos } from '@/lib/negociacoes/dados'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { marcarAvisoLido, marcarTodosLidos } from './actions'
import { Carregando } from '@/components/Carregando'
import { EstadoVazio } from '@/components/tela/EstadoVazio'

export const metadata = { title: 'Avisos' }

async function Lista() {
  const membro = await getMembro()
  if (membro?.papel !== 'dono') {
    return <p className="rounded-[--radius-cartao] border border-linha bg-superficie p-4">Os avisos de vendas fechadas aparecem para o dono da agência.</p>
  }
  const avisos = await listarAvisos()
  const naoLidos = avisos.filter((a) => !a.lido_em).length
  if (avisos.length === 0) {
    return <EstadoVazio acoes={[{ href: '/funil', rotulo: 'Abrir o funil' }]}>Nenhum aviso ainda. Vendas que vão para <strong>Pago</strong> e contatos do formulário aparecem aqui.</EstadoVazio>
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
        {avisos.map((a) => (
          <li key={a.id} className={`flex flex-col gap-1 rounded-[--radius-cartao] border p-4 ${a.lido_em ? 'border-linha bg-superficie' : 'border-primaria bg-primaria-suave'}`}>
            <p className="font-semibold">
              {!a.lido_em && <span className="mr-2 rounded-full bg-primaria px-2 py-0.5 text-xs font-bold text-white">Novo</span>}
              {a.tipo === 'lead_formulario' ? `Novo contato pelo formulário: ${a.cliente_nome}` : `Venda fechada: ${a.titulo}`}
            </p>
            {a.tipo === 'lead_formulario' ? (
              <p className="text-sm text-tinta-suave">{a.titulo} · chegou em {formatarDataHora(a.criado_em)}</p>
            ) : (
              <>
                <p>{a.cliente_nome} · {formatarReais(a.valor_centavos)}</p>
                <p className="text-sm text-tinta-suave">Movida para Pago{a.por_nome ? ` por ${a.por_nome}` : ''} em {formatarDataHora(a.criado_em)}</p>
              </>
            )}
            <div className="flex flex-wrap items-center gap-4">
              {a.negociacao_id && <Link href={`/negociacoes/${a.negociacao_id}`} className="inline-flex min-h-11 items-center text-primaria underline">Ver negociação</Link>}
              {!a.lido_em && (
                <form action={marcarAvisoLido.bind(null, a.id)}><button type="submit" className="min-h-11 underline">Marcar como lido</button></form>
              )}
            </div>
          </li>
        ))}
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
