import { proporcao, textosSituacao } from '@/lib/graficos/graficos'

const PARTES = ['bg-receita', 'bg-despesa', 'bg-controle'] as const

// R96, R99: leads of a campaign split into sold, lost and open. The bar is decoration; the legend carries the numbers.
export function BarraSituacao({ vendidos, perdidos, emAberto }: { vendidos: number; perdidos: number; emAberto: number }) {
  const total = vendidos + perdidos + emAberto
  if (total === 0) return null
  const valores = [vendidos, perdidos, emAberto]
  const textos = textosSituacao({ vendidos, perdidos, emAberto })
  return (
    <div className="flex flex-col gap-1.5">
      <div aria-hidden="true" className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-superficie-suave">
        {valores.map((v, i) => v > 0 && <div key={PARTES[i]} className={`h-full ${PARTES[i]}`} style={{ width: `${proporcao(v, total)}%` }} />)}
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-tinta-suave">
        {textos.map((t, i) => (
          <span key={PARTES[i]} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={`size-2.5 rounded-sm ${PARTES[i]}`} />{t}
          </span>
        ))}
      </p>
    </div>
  )
}
