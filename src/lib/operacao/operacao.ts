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
