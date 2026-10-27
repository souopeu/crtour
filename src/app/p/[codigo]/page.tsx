import type { Metadata } from 'next'
import { ListaRoteiro } from '@/components/passeios/ListaRoteiro'
import { Suspense } from 'react'
import { BotaoImprimir } from '@/components/BotaoImprimir'
import { Carregando } from '@/components/Carregando'
import { formatarDataBr } from '@/lib/formato'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { dadosPropostaSchema, resumoValores } from '@/lib/propostas/proposta'
import { criarClientePublico } from '@/lib/supabase/publico'

export const metadata: Metadata = { title: 'Proposta de viagem', robots: { index: false, follow: false } }

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1 border-t border-linha pt-4 print:break-inside-avoid">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-tinta-suave">{titulo}</h2>
      {children}
    </section>
  )
}

async function Conteudo({ params }: Pick<PageProps<'/p/[codigo]'>, 'params'>) {
  const { codigo } = await params
  const { data } = /^[A-Za-z0-9_-]{24}$/.test(codigo)
    ? await criarClientePublico().rpc('proposta_publica', { p_codigo: codigo })
    : { data: null }
  const linha = (data as { dados: unknown; validade: string }[] | null)?.[0]
  const d = linha ? dadosPropostaSchema.safeParse(linha.dados) : null
  // Expired, revoked or unknown: the same answer, nothing revealed.
  if (!linha || !d?.success) {
    return <p className="text-lg font-semibold">Proposta indisponível. Peça uma nova à agência.</p>
  }
  const p = d.data
  const { porPessoaCentavos, saldoCentavos } = resumoValores(p)
  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-primaria">{p.agencia}</p>
        <h1 className="text-[1.75rem] font-medium tracking-tight">Proposta para {p.cliente}</h1>
        <p className="text-tinta-suave">{p.titulo}</p>
      </header>
      <Bloco titulo="Viagem">
        {p.passeio && <p className="text-lg font-semibold">{p.passeio}{p.destino ? ` · ${p.destino}` : ''}</p>}
        {p.saida && <p>Saída em {formatarDataBr(p.saida)}</p>}
        {p.volta && <p>Volta em {formatarDataBr(p.volta)}</p>}
        <p>{p.pessoas} {p.pessoas === 1 ? 'pessoa' : 'pessoas'}</p>
      </Bloco>
      <Bloco titulo="Valores">
        <p className="text-2xl font-bold tabular-nums">{formatarReais(p.totalCentavos)}</p>
        <p className="tabular-nums">{formatarReais(porPessoaCentavos)} por pessoa</p>
        {p.sinalCentavos > 0 && <p className="tabular-nums">Sinal: {formatarReais(p.sinalCentavos)}{p.sinalAte ? ` até ${formatarDataBr(p.sinalAte)}` : ''}</p>}
        <p className="tabular-nums">Saldo: {formatarReais(saldoCentavos)}{p.saldoAte ? ` até ${formatarDataBr(p.saldoAte)}` : ''}</p>
      </Bloco>
      {p.roteiro.length > 0 && <Bloco titulo="Roteiro"><ListaRoteiro roteiro={p.roteiro} /></Bloco>}
      {(p.inclui || p.naoInclui) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {p.inclui && <Bloco titulo="O que inclui"><p className="whitespace-pre-line">{p.inclui}</p></Bloco>}
          {p.naoInclui && <Bloco titulo="O que não inclui"><p className="whitespace-pre-line">{p.naoInclui}</p></Bloco>}
        </div>
      )}
      {p.observacoes && <Bloco titulo="Observações"><p className="whitespace-pre-line">{p.observacoes}</p></Bloco>}
      <p className="border-t border-linha pt-4 text-sm text-tinta-suave">Proposta válida até {formatarDataBr(linha.validade)}. Valores sujeitos a disponibilidade até a reserva.</p>
      <div className="print:hidden"><BotaoImprimir rotulo="Baixar PDF" /></div>
    </>
  )
}

// R70: the client's page and the printable/PDF version are the same page.
export default function PropostaPublicaPage({ params }: PageProps<'/p/[codigo]'>) {
  return (
    <main className="flex min-h-screen justify-center bg-superficie-suave px-4 py-10 print:bg-white print:p-0">
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-(--radius-cartao) border border-linha bg-superficie p-6 print:border-0">
        <Suspense fallback={<Carregando altura="h-64" />}>
          <Conteudo params={params} />
        </Suspense>
      </div>
    </main>
  )
}
