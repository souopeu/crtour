import { z } from 'zod'

// R136: same order as the database enum `status_operacional`.
export const STATUS_OPERACIONAL = ['a_definir', 'em_organizacao', 'a_comunicar', 'pronta', 'em_execucao'] as const
export type StatusOperacional = (typeof STATUS_OPERACIONAL)[number]

export const statusSchema = z.enum(STATUS_OPERACIONAL)

const ROTULO: Record<StatusOperacional, string> = {
  a_definir: 'A definir', em_organizacao: 'Em organização', a_comunicar: 'A comunicar', pronta: 'Pronta', em_execucao: 'Em execução',
}

export function rotuloDoStatus(s: StatusOperacional): string {
  return ROTULO[s]
}

const posicao = (s: StatusOperacional) => STATUS_OPERACIONAL.indexOf(s)

export function ehVolta(atual: StatusOperacional, novo: StatusOperacional): boolean {
  return posicao(novo) < posicao(atual)
}

export function proximoStatus(atual: StatusOperacional): StatusOperacional | null {
  return STATUS_OPERACIONAL[posicao(atual) + 1] ?? null
}

// Still needs work before the departure: anything before "pronta".
export function precisaOrganizar(s: StatusOperacional): boolean {
  return posicao(s) < posicao('pronta')
}

/** List filter: one status, or "organizar" = everything before ready. */
export type FiltroStatus = StatusOperacional | 'organizar'

export function lerFiltroStatus(params: Record<string, string | string[] | undefined>): FiltroStatus | null {
  const v = params.status
  if (v === 'organizar') return v
  return typeof v === 'string' && statusSchema.safeParse(v).success ? (v as StatusOperacional) : null
}
