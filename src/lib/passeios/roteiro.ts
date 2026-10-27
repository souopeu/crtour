import { z } from 'zod'
import { fimDaExcursao } from '@/lib/operacao/operacao'

// E11-5 (R164): day-by-day itinerary of an excursion. A day with no title and no text is removed.
export type DiaRoteiro = { dia: number; titulo: string | null; descricao: string | null }

export function lerRoteiro(campos: Iterable<[string, FormDataEntryValue]>, dias: number):
  { ok: true; dias: DiaRoteiro[] } | { ok: false; campos: Record<string, string[]> } {
  const valores = new Map([...campos].map(([n, v]) => [n, String(v).trim()]))
  const erros: Record<string, string[]> = {}
  const lista: DiaRoteiro[] = []
  for (let dia = 1; dia <= dias; dia++) {
    const titulo = (valores.get(`titulo_${dia}`) ?? '').slice(0, 120)
    const descricao = (valores.get(`descricao_${dia}`) ?? '').slice(0, 2000)
    if (!titulo && descricao) erros[`titulo_${dia}`] = [`Dê um título ao dia ${dia}.`]
    lista.push({ dia, titulo: titulo || null, descricao: descricao || null })
  }
  return Object.keys(erros).length ? { ok: false, campos: erros } : { ok: true, dias: lista }
}

// Frozen in vouchers and proposals (R165); documents issued before have none.
export const roteiroSchema = z.array(z.object({ dia: z.number().int(), titulo: z.string(), descricao: z.string().nullable() })).default([])
export const voltaSchema = z.string().nullable().default(null)

// From a departure date and its tour (with the itinerary embedded): the days in order and the return date.
export function roteiroDoContexto(saida: string, passeio: { dias: number; passeio_dias: { dia: number; titulo: string; descricao: string | null }[] }) {
  if (passeio.dias <= 1) return { roteiro: [], volta: null }
  const roteiro = passeio.passeio_dias.filter((d) => d.dia <= passeio.dias).sort((a, b) => a.dia - b.dia)
    .map((d) => ({ dia: d.dia, titulo: d.titulo, descricao: d.descricao }))
  return { roteiro, volta: fimDaExcursao(saida, passeio.dias) }
}
