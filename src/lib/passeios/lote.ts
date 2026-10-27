import { z } from 'zod'
import { reaisParaCentavos } from './dinheiro'

// E11-1 (R155–R156): departures in batch. The same limits are enforced by criar_saidas_lote / alterar_saidas_lote.
export const MAX_SAIDAS_LOTE = 500
export const MAX_DIAS_LOTE = 366
export const MAX_HORARIOS_LOTE = 6
export const DIAS_SEMANA = [['1', 'Seg'], ['2', 'Ter'], ['3', 'Qua'], ['4', 'Qui'], ['5', 'Sex'], ['6', 'Sáb'], ['0', 'Dom']] as const

const DIA_MS = 86_400_000
const dataReal = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso
const diasEntre = (de: string, ate: string) => (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA_MS
const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/

// Dates from `de` to `ate` (inclusive) that fall on the weekdays given (0 = Sunday).
export function datasDoLote(de: string, ate: string, dias: number[]): string[] {
  const datas: string[] = []
  for (let t = Date.parse(`${de}T00:00:00Z`); t <= Date.parse(`${ate}T00:00:00Z`); t += DIA_MS) {
    const d = new Date(t)
    if (dias.includes(d.getUTCDay())) datas.push(d.toISOString().slice(0, 10))
  }
  return datas
}

// Same rule as the database: a date and time (or no time) that already has a departure is skipped.
export function contarLote(datas: string[], horarios: string[], existentes: { data: string; horario: string | null }[]) {
  const ja = new Set(existentes.map((s) => `${s.data} ${s.horario?.slice(0, 5) ?? ''}`))
  const hs = horarios.length ? horarios : ['']
  const puladas = datas.flatMap((d) => hs.map((h) => `${d} ${h}`)).filter((k) => ja.has(k)).length
  return { novas: datas.length * hs.length - puladas, puladas }
}

export function lerHorarios(texto: string): string[] | null {
  const partes = texto.split(/[,;\s]+/).filter(Boolean)
  if (!partes.every((h) => HORARIO.test(h))) return null
  return [...new Set(partes)].sort()
}

export const loteSchema = (hoje: string) =>
  z
    .object({
      de: z.string().trim().refine(dataReal, 'Escolha a primeira data.').refine((v) => v >= hoje, 'A primeira data não pode ser no passado.'),
      ate: z.string().trim().refine(dataReal, 'Escolha a última data.'),
      dias: z.array(z.enum(DIAS_SEMANA.map(([v]) => v))).min(1, 'Marque pelo menos um dia da semana.'),
      horarios: z.string().default(''),
      capacidade: z.string().trim().refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 500, 'A capacidade deve ser um número inteiro entre 1 e 500.'),
      preco: z.string().refine((v) => reaisParaCentavos(v) !== null, 'Digite o preço por pessoa, ex.: 89,00 (use 0 se for gratuito).'),
      veiculo: z.string().trim().default('').refine((v) => v === '' || z.uuid().safeParse(v).success, 'Escolha um veículo da lista.'),
      preco_b2b: z.string().default('').refine((v) => v.trim() === '' || reaisParaCentavos(v) !== null, 'Digite o preço B2B, ex.: 70,00, ou deixe em branco.'),
    })
    .superRefine((v, ctx) => {
      if (dataReal(v.de) && dataReal(v.ate)) {
        const n = diasEntre(v.de, v.ate)
        if (n < 0) ctx.addIssue({ code: 'custom', path: ['ate'], message: 'A última data vem antes da primeira.' })
        else if (n >= MAX_DIAS_LOTE) ctx.addIssue({ code: 'custom', path: ['ate'], message: `O período pode ter no máximo ${MAX_DIAS_LOTE} dias.` })
      }
      const horarios = lerHorarios(v.horarios)
      if (horarios === null) return ctx.addIssue({ code: 'custom', path: ['horarios'], message: 'Digite os horários como 08:00, 14:30.' })
      if (horarios.length > MAX_HORARIOS_LOTE) return ctx.addIssue({ code: 'custom', path: ['horarios'], message: `No máximo ${MAX_HORARIOS_LOTE} horários.` })
      if (ctx.issues?.length) return
      const total = datasDoLote(v.de, v.ate, v.dias.map(Number)).length * Math.max(horarios.length, 1)
      if (total === 0) ctx.addIssue({ code: 'custom', path: ['dias'], message: 'Nenhuma data do período cai nesses dias da semana.' })
      else if (total > MAX_SAIDAS_LOTE) ctx.addIssue({ code: 'custom', path: ['horarios'], message: `Isso daria ${total} saídas; o máximo por vez é ${MAX_SAIDAS_LOTE}. Diminua o período ou os horários.` })
    })
    .transform((v) => ({
      datas: datasDoLote(v.de, v.ate, v.dias.map(Number)),
      horarios: lerHorarios(v.horarios) as string[],
      capacidade: Number(v.capacidade),
      preco_centavos: reaisParaCentavos(v.preco) as number,
      veiculo_id: v.veiculo === '' ? null : v.veiculo,
      preco_b2b_centavos: v.preco_b2b.trim() === '' ? null : reaisParaCentavos(v.preco_b2b), // R162: owner only
    }))

export const alteracaoLoteSchema = z
  .object({
    saidas: z.array(z.uuid()).min(1, 'Marque pelo menos uma saída.').max(MAX_SAIDAS_LOTE, `Marque no máximo ${MAX_SAIDAS_LOTE} saídas.`),
    preco: z.string().trim().refine((v) => v === '' || reaisParaCentavos(v) !== null, 'Digite o novo preço, ex.: 89,00.'),
    capacidade: z.string().trim().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 500), 'As vagas devem ser um número inteiro entre 1 e 500.'),
  })
  .refine((v) => v.preco !== '' || v.capacidade !== '', { path: ['preco'], message: 'Digite o novo preço, as novas vagas ou os dois.' })
  .transform((v) => ({
    saidas: v.saidas,
    preco_centavos: v.preco === '' ? null : (reaisParaCentavos(v.preco) as number),
    capacidade: v.capacidade === '' ? null : Number(v.capacidade),
  }))

const MOTIVO: Record<string, string> = {
  CR003: 'com mais vagas vendidas do que o novo número',
  CR019: 'com vagas acima dos lugares do veículo',
  passada: 'já passou',
  '42501': 'não encontrada',
}
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export function resumoDaAlteracao(marcadas: number, falhas: { motivo: string }[]): string {
  const feitas = plural(marcadas - falhas.length, 'saída alterada', 'saídas alteradas')
  if (falhas.length === 0) return `${feitas}.`
  const porMotivo = new Map<string, number>()
  for (const f of falhas) porMotivo.set(f.motivo, (porMotivo.get(f.motivo) ?? 0) + 1)
  const motivos = [...porMotivo].map(([m, n]) => `${n} ${MOTIVO[m] ?? 'não alterada'}`).join('; ')
  return `${feitas}. ${plural(falhas.length, 'ficou', 'ficaram')} de fora: ${motivos}.`
}
