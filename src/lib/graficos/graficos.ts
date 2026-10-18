// Small helpers for the CSS/SVG charts (spec 19, R96–R98). The numbers are always shown in text; bars only reinforce them.

// Width of a bar as a share of the largest value, clamped to 0–100%.
export function proporcao(valor: number, maximo: number): number {
  if (maximo <= 0 || valor <= 0) return 0
  return Math.min(100, (valor / maximo) * 100)
}

const contar = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

type Situacao = { vendidos: number; perdidos: number; emAberto: number }

// R96: the text of each part of a campaign's split bar, in bar order.
export const textosSituacao = (s: Situacao): [string, string, string] =>
  [contar(s.vendidos, 'vendido', 'vendidos'), contar(s.perdidos, 'perdido', 'perdidos'), `${s.emAberto} em aberto`]

export const legendaSituacao = (s: Situacao) => textosSituacao(s).join(' · ')

// The `quantos` months ending at `mes` (YYYY-MM), oldest first.
export function mesesAte(mes: string, quantos: number): string[] {
  const [ano, m] = mes.split('-').map(Number)
  return Array.from({ length: quantos }, (_, i) => {
    const d = new Date(Date.UTC(ano, m - 1 - (quantos - 1 - i), 1))
    return d.toISOString().slice(0, 7)
  })
}
