import { proporcao } from '@/lib/graficos/graficos'

// R98: a thin bar under a table number, sized against the table's largest value. Decoration only (R99).
export function BarraLinha({ valor, maximo }: { valor: number; maximo: number }) {
  const largura = proporcao(valor, maximo)
  if (largura === 0) return null
  return <div aria-hidden="true" className="mt-1 h-1.5 rounded-full bg-primaria" style={{ width: `${largura}%` }} />
}
