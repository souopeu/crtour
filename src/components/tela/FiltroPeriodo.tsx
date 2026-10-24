import Link from 'next/link'
import { ATALHOS_PERIODO, ROTULO_ATALHO, hrefPeriodo, type Periodo } from '@/lib/periodo/periodo'
import { campoBarra, cartaoFiltros, rotuloBarra, botaoSecundario } from './estilos'

type Parametros = Record<string, string | string[] | undefined>

// R135: shortcut links plus optional typed dates (a GET form, works without JavaScript). Everything lives in the address.
export function FiltroPeriodo({ base, periodo, params, titulo = 'Período', dica }: {
  base: string; periodo: Periodo; params: Parametros; titulo?: string; dica?: string
}) {
  const outros = Object.entries(params).filter(([chave, valor]) => !['de', 'ate', 'periodo'].includes(chave) && typeof valor === 'string')
  return (
    <section aria-label={titulo} className={cartaoFiltros}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {dica ? <p className="text-xs text-tinta-suave">{dica}</p> : null}
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <nav aria-label="Atalhos de período" className="flex flex-wrap gap-2">
          {ATALHOS_PERIODO.map((a) => (
            <Link
              key={a}
              href={hrefPeriodo(base, a, params)}
              aria-current={periodo.atalho === a ? 'page' : undefined}
              className="inline-flex min-h-11 items-center rounded-lg border border-controle bg-superficie px-4 text-sm hover:bg-superficie-suave aria-[current=page]:border-marca aria-[current=page]:bg-marca aria-[current=page]:font-semibold aria-[current=page]:text-white"
            >
              {ROTULO_ATALHO[a]}
            </Link>
          ))}
        </nav>
        <form method="get" action={base} className="flex flex-wrap items-end gap-2">
          {outros.map(([chave, valor]) => <input key={chave} type="hidden" name={chave} value={valor as string} />)}
          <label className="flex flex-col gap-1">
            <span className={rotuloBarra}>A partir de</span>
            <input type="date" name="de" defaultValue={periodo.atalho ? '' : (periodo.de ?? '')} className={campoBarra} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={rotuloBarra}>Até (opcional)</span>
            <input type="date" name="ate" defaultValue={periodo.atalho ? '' : (periodo.ate ?? '')} className={campoBarra} />
          </label>
          <button type="submit" className={botaoSecundario}>Aplicar</button>
        </form>
      </div>
    </section>
  )
}
