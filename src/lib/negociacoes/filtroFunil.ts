import { z } from 'zod'

// Funnel toolbar state (R60): read from the URL, so switching views keeps the search and the person.
export type FiltroFunil = { visao: 'kanban' | 'tabela'; agrupar: 'etapa' | 'responsavel'; q: string; pessoa: string | null }
type Parametros = Record<string, string | string[] | undefined>

const um = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')
const SEM_RESPONSAVEL = 'sem'

// Anything invalid in the URL is ignored (never an error page).
export function lerFiltroFunil(p: Parametros): FiltroFunil {
  const pessoa = um(p.pessoa)
  return {
    visao: um(p.visao) === 'tabela' ? 'tabela' : 'kanban',
    agrupar: um(p.agrupar) === 'responsavel' ? 'responsavel' : 'etapa',
    q: um(p.q).trim().slice(0, 100),
    pessoa: pessoa === SEM_RESPONSAVEL || z.uuid().safeParse(pessoa).success ? pessoa : null,
  }
}

export function hrefFunil(f: FiltroFunil): string {
  const q = new URLSearchParams()
  if (f.visao === 'tabela') q.set('visao', 'tabela')
  if (f.agrupar === 'responsavel') q.set('agrupar', 'responsavel')
  if (f.q) q.set('q', f.q)
  if (f.pessoa) q.set('pessoa', f.pessoa)
  const s = q.toString()
  return s ? `/funil?${s}` : '/funil'
}

const normalizar = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function filtrarNegociacoes<T extends { titulo: string; cliente_nome: string; responsavel_id: string | null }>(lista: T[], f: FiltroFunil): T[] {
  const busca = normalizar(f.q)
  return lista.filter((n) =>
    (!busca || normalizar(`${n.titulo} ${n.cliente_nome}`).includes(busca))
    && (!f.pessoa || (f.pessoa === SEM_RESPONSAVEL ? n.responsavel_id === null : n.responsavel_id === f.pessoa)))
}
