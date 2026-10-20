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

// R120: geometry for the SVG gauge, pie and line (pure, so it is tested; the drawings are decoration next to the numbers).
type Ponto = { x: number; y: number }
const arred = (n: number) => Math.round(n * 100) / 100

// Gauge: a half circle from the left (fraction 0) over the top to the right (fraction 1); fractions outside 0–1 are clamped.
export function pontoNoSemicirculo(cx: number, cy: number, r: number, fracao: number): Ponto {
  const a = Math.PI * (1 - Math.min(1, Math.max(0, fracao)))
  return { x: arred(cx + r * Math.cos(a)), y: arred(cy - r * Math.sin(a)) }
}

export function arcoSemicirculo(cx: number, cy: number, r: number, de: number, ate: number): string {
  const a = pontoNoSemicirculo(cx, cy, r, de)
  const b = pontoNoSemicirculo(cx, cy, r, ate)
  return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`
}

// Pie: one path per non-zero value, clockwise from the top, plus its share (0–1). A single 100% slice is a full circle.
export function fatiasPizza(valores: number[], cx: number, cy: number, r: number): { caminho: string; fracao: number }[] {
  const total = valores.reduce((s, v) => s + Math.max(0, v), 0)
  if (total <= 0) return valores.map(() => ({ caminho: '', fracao: 0 }))
  const ponto = (f: number): Ponto => ({ x: arred(cx + r * Math.sin(2 * Math.PI * f)), y: arred(cy - r * Math.cos(2 * Math.PI * f)) })
  let inicio = 0
  return valores.map((v) => {
    const fracao = Math.max(0, v) / total
    if (fracao === 0) return { caminho: '', fracao }
    const fim = inicio + fracao
    const a = ponto(inicio)
    const b = ponto(fim)
    const caminho = fracao >= 1
      ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`
      : `M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 ${fracao > 0.5 ? 1 : 0} 1 ${b.x} ${b.y} Z`
    inicio = fim
    return { caminho, fracao }
  })
}

// Line: points spread evenly across `largura`, highest value at the top (y = 0), zero at `altura`.
export function pontosLinha(valores: number[], largura: number, altura: number): Ponto[] {
  const maximo = Math.max(0, ...valores)
  const passo = valores.length > 1 ? largura / (valores.length - 1) : 0
  return valores.map((v, i) => ({
    x: arred(valores.length > 1 ? i * passo : largura / 2),
    y: arred(altura - (proporcao(v, maximo) / 100) * altura),
  }))
}
