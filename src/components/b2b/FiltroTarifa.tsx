import Link from 'next/link'
import { rotuloBarra } from '@/components/tela/estilos'
import { TARIFAS, hrefTarifa, type Tarifa } from '@/lib/b2b/tarifa'

// R163: Todas as tarifas · Balcão · B2B, keeping the other filters of the page.
export function FiltroTarifa({ base, params, atual }: { base: string; params: Record<string, string | string[] | undefined>; atual: Tarifa | null }) {
  const opcoes: [Tarifa | null, string][] = [[null, 'Todas as tarifas'], ...(Object.entries(TARIFAS) as [Tarifa, string][])]
  return (
    <nav aria-label="Tarifa" className="flex flex-wrap items-center gap-1.5">
      <span className={rotuloBarra}>Tarifa:</span>
      {opcoes.map(([valor, rotulo]) => (
        <Link key={rotulo} href={hrefTarifa(base, params, valor)} aria-current={atual === valor ? 'page' : undefined}
          className="inline-flex min-h-9 items-center rounded-full border border-linha bg-superficie px-3 text-sm hover:bg-superficie-suave aria-[current=page]:border-marca aria-[current=page]:bg-primaria-suave aria-[current=page]:font-semibold aria-[current=page]:text-primaria">
          {rotulo}
        </Link>
      ))}
    </nav>
  )
}
