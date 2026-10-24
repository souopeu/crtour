import { z } from 'zod'

// R135: period of the departure date, as shortcuts or typed dates, kept in the address.
export const ATALHOS_PERIODO = ['hoje', 'amanha', 'proximas', 'todas'] as const
export type AtalhoPeriodo = (typeof ATALHOS_PERIODO)[number]
export const ATALHO_PADRAO: AtalhoPeriodo = 'proximas'

export const ROTULO_ATALHO: Record<AtalhoPeriodo, string> = { hoje: 'Hoje', amanha: 'Amanhã', proximas: 'Próximas', todas: 'Todas' }

/** `atalho` is null when typed dates are in use. `de`/`ate` are inclusive YYYY-MM-DD; null = open end. */
export type Periodo = { atalho: AtalhoPeriodo | null; de: string | null; ate: string | null }

type Parametros = Record<string, string | string[] | undefined>

// A real calendar day only: "2026-02-30" is refused.
const dia = z.iso.date()

function lerDia(valor: string | string[] | undefined): string | null {
  return typeof valor === 'string' && dia.safeParse(valor).success ? valor : null
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`) // noon UTC: no timezone can shift the day
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function lerPeriodo(params: Parametros, hoje: string): Periodo {
  const de = lerDia(params.de)
  const ate = lerDia(params.ate)
  if (de || ate) {
    if (de && ate && ate < de) return { atalho: null, de: ate, ate: de }
    return { atalho: null, de, ate }
  }
  const bruto = params.periodo
  const atalho = (ATALHOS_PERIODO as readonly unknown[]).includes(bruto) ? (bruto as AtalhoPeriodo) : ATALHO_PADRAO
  switch (atalho) {
    case 'hoje': return { atalho, de: hoje, ate: hoje }
    case 'amanha': { const amanha = somarDias(hoje, 1); return { atalho, de: amanha, ate: amanha } }
    case 'proximas': return { atalho, de: hoje, ate: null }
    case 'todas': return { atalho, de: null, ate: null }
  }
}

// Link for a shortcut that keeps the screen's other filters; typed dates give way to the shortcut.
export function hrefPeriodo(base: string, atalho: AtalhoPeriodo, params: Parametros): string {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(params)) {
    if (chave === 'de' || chave === 'ate' || chave === 'periodo' || typeof valor !== 'string') continue
    busca.set(chave, valor)
  }
  if (atalho !== ATALHO_PADRAO) busca.set('periodo', atalho)
  const texto = busca.toString()
  return texto ? `${base}?${texto}` : base
}
