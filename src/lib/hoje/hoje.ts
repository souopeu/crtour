import { z } from 'zod'
import { diaNoBrasil } from '@/lib/formato'
import { ehGanha, type Etapa } from '@/lib/negociacoes/negociacoes'
import { diasAte } from '@/lib/pagamentos/cobranca'

// Brazilian calendar days between an instant and today (YYYY-MM-DD).
export const diasDesde = (iso: string, hoje: string) => diasAte(hoje, diaNoBrasil(iso))

export const textoHaDias = (dias: number) => (dias <= 0 ? 'hoje' : `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`)

// Pending activities: before today = late, today = today; future ones stay on the client sheet. Oldest first.
export function separarAtividades<T extends { quando: string }>(lista: T[], hoje: string) {
  const ordenada = [...lista].sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando))
  return {
    atrasadas: ordenada.filter((a) => diaNoBrasil(a.quando) < hoje),
    deHoje: ordenada.filter((a) => diaNoBrasil(a.quando) === hoje),
  }
}

// "Parada": still open (not won, not lost) and more than `dias` days in the same stage.
export function estaParada(etapa: Etapa, etapaDesde: string, dias: number, hoje: string): boolean {
  return !ehGanha(etapa) && etapa !== 'perdido' && diasDesde(etapaDesde, hoje) > dias
}

// Start of the Brazilian day (hoje − dias + 1): an interaction before it was `dias` or more days ago.
export function limiteSemContato(hoje: string, dias: number): string {
  const d = new Date(`${hoje}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - dias + 1)
  return `${d.toISOString().slice(0, 10)}T00:00:00-03:00` // Brazil has no DST since 2019
}

const dias = z
  .string()
  .trim()
  .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 365, 'Use um número inteiro de dias, de 1 a 365.')
  .transform(Number)

export const limitesSchema = z.object({ diasSemContato: dias, diasParada: dias })

export type Visao = 'minhas' | 'todas'

// "Só as minhas" vs "Todas" on the Hoje screen: sellers start on their own items, owners on everything.
export function lerVisao(p: Record<string, string | string[] | undefined>, papel: 'dono' | 'vendedor'): Visao {
  const v = p.ver
  if (v === 'minhas' || v === 'todas') return v
  return papel === 'vendedor' ? 'minhas' : 'todas'
}
