import Link from 'next/link'
import { Suspense } from 'react'
import { listarEtiquetas } from '@/lib/clientes/dados'
import { listarSegmentos } from '@/lib/segmentos/dados'
import { descreverCriterios } from '@/lib/segmentos/segmentos'

export const metadata = { title: 'Remarketing' }

async function Lista() {
  const [segmentos, etiquetas] = await Promise.all([listarSegmentos(), listarEtiquetas()])
  const nomes = new Map(etiquetas.map((e) => [e.id, e.nome]))
  if (segmentos.length === 0) {
    return <p className="rounded-[--radius-cartao] border border-linha bg-superficie p-4">Nenhum segmento ainda. Crie o primeiro escolhendo quem quer chamar (destino, aniversário, sem contato…).</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {segmentos.map((s) => (
        <li key={s.id} className="flex flex-col gap-1 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
          <Link href={`/remarketing/${s.id}`} className="font-semibold text-primaria underline">{s.nome}</Link>
          <p className="text-sm text-tinta-suave">{descreverCriterios(s.criterios, nomes).join(' · ')} · rodada {s.rodada}</p>
        </li>
      ))}
    </ul>
  )
}

export default function RemarketingPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Remarketing</h1>
        <Link href="/remarketing/novo" className="inline-flex min-h-12 items-center rounded-full bg-destaque px-6 font-semibold text-destaque-texto">Novo segmento</Link>
      </div>
      <p className="max-w-prose text-sm text-tinta-suave">
        Envio um a um pelo WhatsApp, só para quem aceitou receber mensagens. Cada envio vira atividade na ficha do cliente.
      </p>
      <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-40" />}>
        <Lista />
      </Suspense>
    </div>
  )
}
