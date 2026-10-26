import Link from 'next/link'
import { formatarDataBr } from '@/lib/formato'
import { somarDias } from '@/lib/periodo/periodo'
import { botaoSecundario, campoBarra, cartaoFiltros } from './estilos'

const DIAS = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' })
const diaDaSemana = (iso: string) => DIAS.format(new Date(`${iso}T12:00:00Z`))
const seta = 'inline-flex size-11 items-center justify-center rounded-lg border border-controle bg-superficie hover:bg-superficie-suave'

// Day picker for day screens (arrows, date field, "Hoje"). `max` hides the way to days after it.
export function SeletorDeDia({ caminho, rotulo, dia, hoje, max }: { caminho: string; rotulo: string; dia: string; hoje: string; max?: string }) {
  const proximo = somarDias(dia, 1)
  return (
    <section aria-label="Escolher o dia" className={cartaoFiltros}>
      <div className="flex flex-wrap items-end gap-2">
        <Link href={`${caminho}?dia=${somarDias(dia, -1)}`} className={seta} aria-label="Dia anterior">‹</Link>
        <form method="get" action={caminho} className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-tinta-suave">{rotulo}</span>
            <input type="date" name="dia" defaultValue={dia} max={max} className={campoBarra} />
          </label>
          <button type="submit" className={botaoSecundario}>Ver</button>
        </form>
        {(!max || proximo <= max) && <Link href={`${caminho}?dia=${proximo}`} className={seta} aria-label="Próximo dia">›</Link>}
        <Link href={caminho} aria-current={dia === hoje ? 'page' : undefined}
          className="inline-flex min-h-11 items-center rounded-lg border border-controle bg-superficie px-4 text-sm aria-[current=page]:border-marca aria-[current=page]:bg-marca aria-[current=page]:font-semibold aria-[current=page]:text-white">
          Hoje
        </Link>
      </div>
      <p className="text-sm text-tinta-suave">{formatarDataBr(dia)}, {diaDaSemana(dia)}{dia === hoje ? ' (hoje)' : ''}</p>
    </section>
  )
}
