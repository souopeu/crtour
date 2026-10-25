import { z } from 'zod'
import { NOME_A_INFORMAR } from '@/lib/passageiros/lista'

// R141: one place per person travelling, keyed like the database `embarques` row:
// responsible client = (passageiro null, vaga 0), named companion = (passageiro id, vaga 0), unnamed place = (null, 1…).
export type ReservaDoEmbarque = { id: string; cliente_nome: string; qtd_pessoas: number; situacao: 'ativa' | 'cancelada' }
export type PassageiroDoEmbarque = { id: string; reserva_id: string; nome: string }
export type EmbarqueFeito = { reserva_id: string; passageiro_id: string | null; vaga: number; embarcou_em: string; marcado_por: string | null }
export type Lugar = {
  chave: string; reservaId: string; responsavel: string; passageiroId: string | null; vaga: number
  nome: string; tipo: 'Responsável' | 'Acompanhante'; embarque: { em: string; por: string | null } | null
}

const chaveDe = (reservaId: string, passageiroId: string | null, vaga: number) => `${reservaId}:${passageiroId ?? '-'}:${vaga}`

export function montarEmbarque(reservas: ReservaDoEmbarque[], passageiros: PassageiroDoEmbarque[], feitos: EmbarqueFeito[]): Lugar[] {
  const porChave = new Map(feitos.map((f) => [chaveDe(f.reserva_id, f.passageiro_id, f.vaga), { em: f.embarcou_em, por: f.marcado_por }]))
  const lugar = (r: ReservaDoEmbarque, passageiroId: string | null, vaga: number, nome: string, tipo: Lugar['tipo']): Lugar => {
    const chave = chaveDe(r.id, passageiroId, vaga)
    return { chave, reservaId: r.id, responsavel: r.cliente_nome, passageiroId, vaga, nome, tipo, embarque: porChave.get(chave) ?? null }
  }
  return reservas.filter((r) => r.situacao === 'ativa').flatMap((r) => {
    const nomeados = passageiros.filter((p) => p.reserva_id === r.id)
    const semNome = Math.max(r.qtd_pessoas - 1 - nomeados.length, 0)
    return [
      lugar(r, null, 0, r.cliente_nome, 'Responsável'),
      ...nomeados.map((p) => lugar(r, p.id, 0, p.nome, 'Acompanhante')),
      ...Array.from({ length: semNome }, (_, i) => lugar(r, null, i + 1, NOME_A_INFORMAR, 'Acompanhante')),
    ]
  })
}

// Marks on places that no longer exist (an unnamed place that got a name) do not count.
export function contarEmbarque(lugares: Lugar[]): { embarcados: number; total: number } {
  return { embarcados: lugares.filter((l) => l.embarque).length, total: lugares.length }
}

export const lugarSchema = z.object({
  passageiro: z.string().refine((v) => v === '' || z.uuid().safeParse(v).success).transform((v) => (v === '' ? null : v)),
  vaga: z.string().regex(/^\d{1,3}$/).transform(Number).refine((n) => n <= 499),
  embarcou: z.enum(['0', '1']).transform((v) => v === '1'),
})
