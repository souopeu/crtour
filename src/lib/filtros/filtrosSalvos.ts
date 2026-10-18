import { z } from 'zod'
import { hrefDaLista, lerFiltros, type Filtros } from '@/lib/clientes/filtros'
import { hrefFunil, lerFiltroFunil, type FiltroFunil } from '@/lib/negociacoes/filtroFunil'

export type TelaFiltro = 'funil' | 'clientes'
export type FiltroSalvo = { id: string; nome: string; parametros: string }

export const LIMITE_POR_TELA = 20
export const nomeFiltroSchema = z.string().trim().min(1, 'Dê um nome ao filtro.').max(40, 'Use até 40 letras.')

const consulta = (href: string) => href.split('?')[1] ?? ''

// Saved = the screen's own canonical URL (page number left out); anything it does not understand is dropped.
export function parametrosCanonicos(tela: TelaFiltro, bruto: string): string {
  const p = Object.fromEntries(new URLSearchParams(bruto.replace(/^\?/, '')))
  return tela === 'clientes'
    ? consulta(hrefDaLista({ ...lerFiltros(p), pagina: 1 }))
    : consulta(hrefFunil(lerFiltroFunil(p)))
}

/** The link always goes back through the screen reader, never as stored (R83). */
export function hrefFiltro(tela: TelaFiltro, parametros: string): string {
  const q = parametrosCanonicos(tela, parametros)
  const base = tela === 'clientes' ? '/' : '/funil'
  return q ? `${base}?${q}` : base
}

// R84: a tag or person that no longer exists is ignored and the screen says so.
export function semClienteInexistente(f: Filtros, etiquetas: string[]): { filtros: Filtros; sumiu: boolean } {
  const sumiu = f.etiqueta !== null && !etiquetas.includes(f.etiqueta)
  return { filtros: sumiu ? { ...f, etiqueta: null } : f, sumiu }
}

export function semPessoaInexistente(f: FiltroFunil, membros: string[]): { filtro: FiltroFunil; sumiu: boolean } {
  const sumiu = f.pessoa !== null && f.pessoa !== 'sem' && !membros.includes(f.pessoa)
  return { filtro: sumiu ? { ...f, pessoa: null } : f, sumiu }
}
