import { CONSULTAS } from './config'

type Resposta<T> = { data: T[] | null; error: { code?: string } | null }

// Runs `buscar` (a query ending in .in(coluna, bloco)) over blocks of at most IDS_POR_PEDIDO unique ids, in parallel.
// Same shape as a Supabase answer; a failed block is logged and reported, the others still count.
export async function emBlocos<T>(ids: readonly string[], buscar: (bloco: string[]) => PromiseLike<Resposta<T>>): Promise<{ data: T[]; error: { code?: string } | null }> {
  const unicos = [...new Set(ids)]
  const blocos: string[][] = []
  for (let i = 0; i < unicos.length; i += CONSULTAS.IDS_POR_PEDIDO) blocos.push(unicos.slice(i, i + CONSULTAS.IDS_POR_PEDIDO))
  const respostas = await Promise.all(blocos.map(buscar))
  const error = respostas.find((r) => r.error)?.error ?? null
  if (error) console.error('busca em blocos falhou', error.code)
  return { data: respostas.flatMap((r) => r.data ?? []), error }
}
