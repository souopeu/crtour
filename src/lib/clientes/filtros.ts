import { z } from 'zod'
import { ORIGENS } from './schema'

export const POR_PAGINA = 25
const PAGINA_MAXIMA = 10000

export type Origem = (typeof ORIGENS)[number]
export type Filtros = { q: string; etiqueta: string | null; origem: Origem | null; cidade: string; pagina: number }
type Parametros = Record<string, string | string[] | undefined>

const um = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

// Anything invalid in the URL is ignored (never an error page).
export function lerFiltros(p: Parametros): Filtros {
  const etiqueta = z.uuid().safeParse(um(p.etiqueta))
  const origem = um(p.origem)
  const pagina = Number.parseInt(um(p.pagina), 10)
  return {
    q: um(p.q).trim().slice(0, 100),
    etiqueta: etiqueta.success ? etiqueta.data : null,
    origem: (ORIGENS as readonly string[]).includes(origem) ? (origem as Origem) : null,
    cidade: um(p.cidade).trim().slice(0, 120),
    pagina: Number.isFinite(pagina) && pagina >= 1 ? Math.min(pagina, PAGINA_MAXIMA) : 1,
  }
}

export function hrefDaLista(f: Filtros): string {
  const q = new URLSearchParams()
  if (f.q) q.set('q', f.q)
  if (f.etiqueta) q.set('etiqueta', f.etiqueta)
  if (f.origem) q.set('origem', f.origem)
  if (f.cidade) q.set('cidade', f.cidade)
  if (f.pagina > 1) q.set('pagina', String(f.pagina))
  const s = q.toString()
  return s ? `/?${s}` : '/'
}

export function resumoDaPagina(total: number, pagina: number) {
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  return {
    de: total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1,
    ate: Math.min(pagina * POR_PAGINA, total),
    paginas,
    temAnterior: pagina > 1,
    temProxima: pagina < paginas,
  }
}
