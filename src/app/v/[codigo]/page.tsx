import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BotaoImprimir } from '@/components/BotaoImprimir'
import { Carregando } from '@/components/Carregando'
import { siteDaRequisicao } from '@/lib/auth/siteDaRequisicao'
import { matrizQr } from '@/lib/formulario/qr'
import { formatarDataBr } from '@/lib/formato'
import { criarClientePublico } from '@/lib/supabase/publico'
import { dadosVoucherSchema } from '@/lib/vouchers/voucher'

export const metadata: Metadata = { title: 'Voucher de viagem', robots: { index: false, follow: false } }

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1 border-t border-linha pt-4 print:break-inside-avoid">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-tinta-suave">{titulo}</h2>
      {children}
    </section>
  )
}

function Qr({ texto }: { texto: string }) {
  const m = matrizQr(texto)
  const n = m.length
  return (
    <svg role="img" aria-label="QR code do voucher" viewBox={`-2 -2 ${n + 4} ${n + 4}`} className="size-32 bg-white" shapeRendering="crispEdges">
      {m.flatMap((linha, l) => linha.map((escuro, c) => (escuro ? <rect key={`${l}-${c}`} x={c} y={l} width={1} height={1} /> : null)))}
    </svg>
  )
}

async function Conteudo({ params }: Pick<PageProps<'/v/[codigo]'>, 'params'>) {
  const { codigo } = await params
  const { data } = /^[A-Za-z0-9_-]{24}$/.test(codigo)
    ? await criarClientePublico().rpc('voucher_publico', { p_codigo: codigo })
    : { data: null }
  const linha = (data as { dados: unknown }[] | null)?.[0]
  const d = linha ? dadosVoucherSchema.safeParse(linha.dados) : null
  // Revoked, cancelled or unknown: the same answer, nothing revealed.
  if (!d?.success) return <p className="text-lg font-semibold">Voucher indisponível. Fale com a agência.</p>
  const v = d.data
  const site = await siteDaRequisicao()
  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-primaria">{v.agencia}</p>
        <h1 className="text-[1.75rem] font-medium tracking-tight">Voucher de {v.cliente}</h1>
        <p className="text-tinta-suave">Apresente este voucher no dia do passeio.</p>
      </header>
      <Bloco titulo="Passeio">
        <p className="text-lg font-semibold">{v.passeio}{v.destino ? ` · ${v.destino}` : ''}</p>
        <p>Saída em {formatarDataBr(v.saida)}{v.horario ? ` às ${v.horario}` : ''}</p>
        {v.encontro && <p>Encontro: {v.encontro}</p>}
      </Bloco>
      <Bloco titulo={`Passageiros (${v.pessoas})`}>
        <ol className="list-decimal pl-5">{v.passageiros.map((nome, i) => <li key={i}>{nome}</li>)}</ol>
      </Bloco>
      {v.inclui && <Bloco titulo="O que inclui"><p className="whitespace-pre-line">{v.inclui}</p></Bloco>}
      {v.observacoes && <Bloco titulo="Observações"><p className="whitespace-pre-line">{v.observacoes}</p></Bloco>}
      {site && <div className="flex justify-center border-t border-linha pt-4"><Qr texto={`${site}/v/${codigo}`} /></div>}
      <div className="print:hidden"><BotaoImprimir rotulo="Baixar PDF" /></div>
    </>
  )
}

// R76: the client's page and the printable/PDF version are the same page.
export default function VoucherPublicoPage({ params }: PageProps<'/v/[codigo]'>) {
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
