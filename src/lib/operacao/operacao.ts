import { z } from 'zod'

const dia = z.iso.date()

// R139: the day shown on Saídas do dia, from the address; anything else means today.
export function lerDia(valor: string | string[] | undefined, hoje: string): string {
  return typeof valor === 'string' && dia.safeParse(valor).success ? valor : hoje
}

// By time ('HH:MM:SS' sorts as text); departures without a time go last; ties by tour name. Returns a new array.
export function ordenarPorHorario<T extends { horario: string | null; passeio: string }>(saidas: readonly T[]): T[] {
  return [...saidas].sort((a, b) => {
    if (a.horario !== b.horario) {
      if (a.horario === null) return 1
      if (b.horario === null) return -1
      return a.horario.localeCompare(b.horario)
    }
    return a.passeio.localeCompare(b.passeio)
  })
}

/** Share of seats taken, 0–100, for the occupancy bar. */
export function ocupacao(reservadas: number, capacidade: number): number {
  if (capacidade <= 0) return 100
  return Math.min(100, Math.round((reservadas / capacidade) * 100))
}

export type SaidaDestino = { id: string; passeioId: string; data: string; situacao: string; livres: number }

// R140: where a reservation of `pessoas` can go — open departures of the same tour, from today on, with room.
// The database checks all of this again under a lock; this only keeps the list honest.
export function destinosParaMover<T extends SaidaDestino>(saidas: readonly T[], atual: string, passeioId: string, pessoas: number, hoje: string): T[] {
  return saidas
    .filter((s) => s.id !== atual && s.passeioId === passeioId && s.situacao === 'aberta' && s.data >= hoje && s.livres >= pessoas)
    .sort((a, b) => a.data.localeCompare(b.data))
}

const DIA_MS = 86_400_000
// R165: day number of an excursion on a date (1 = the departure date) and its last day.
export const diaDaExcursao = (inicio: string, dia: string) => Math.round((Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / DIA_MS) + 1
export const fimDaExcursao = (inicio: string, dias: number) => new Date(Date.parse(`${inicio}T00:00:00Z`) + (dias - 1) * DIA_MS).toISOString().slice(0, 10)
