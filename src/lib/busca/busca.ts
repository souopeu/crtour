export type TipoResultado = 'cliente' | 'negociacao' | 'passeio'

export type ResultadoBusca = {
  tipo: TipoResultado
  id: string
  titulo: string
  detalhe: string | null
  data: string | null
}

export type GrupoBusca = { tipo: TipoResultado; rotulo: string; itens: ResultadoBusca[] }

export const MIN_LETRAS = 2
export const MAX_LETRAS = 100

const GRUPOS: { tipo: TipoResultado; rotulo: string }[] = [
  { tipo: 'cliente', rotulo: 'Clientes' },
  { tipo: 'negociacao', rotulo: 'Negociações' },
  { tipo: 'passeio', rotulo: 'Passeios' },
]

const CAMPOS_DE_TEXTO = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** "/" opens the search, except while typing in a field or with a modifier (browser shortcuts). */
export function atalhoAbreBusca(
  e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean },
  alvo: { tagName?: string; isContentEditable?: boolean } | null,
): boolean {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return false
  return !(alvo?.isContentEditable || CAMPOS_DE_TEXTO.has(alvo?.tagName ?? ''))
}

export function termoValido(termo: string): string | null {
  const t = termo.trim().slice(0, MAX_LETRAS)
  return t.length >= MIN_LETRAS ? t : null
}

export function hrefResultado(r: Pick<ResultadoBusca, 'tipo' | 'id'>): string {
  return { cliente: '/clientes/', negociacao: '/negociacoes/', passeio: '/passeios/' }[r.tipo] + r.id
}

/** The full list that already has a search field (`q`); tours have none. */
export function hrefVerTodos(tipo: TipoResultado, termo: string): string | null {
  const base = { cliente: '/', negociacao: '/funil', passeio: null }[tipo]
  return base === null ? null : `${base}?${new URLSearchParams({ q: termo })}`
}

export function agrupar(resultados: ResultadoBusca[]): GrupoBusca[] {
  return GRUPOS
    .map((g) => ({ ...g, itens: resultados.filter((r) => r.tipo === g.tipo) }))
    .filter((g) => g.itens.length > 0)
}
