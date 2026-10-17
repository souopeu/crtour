import { z } from 'zod'
import { diasAte } from '@/lib/pagamentos/cobranca'
import { diaNoBrasil, formatarDataBr } from '@/lib/formato'

export type TipoAtividade = 'ligacao' | 'whatsapp' | 'email' | 'reuniao' | 'tarefa'
export type StatusAtividade = 'pendente' | 'feito'

export const TIPOS: { valor: TipoAtividade; rotulo: string }[] = [
  { valor: 'ligacao', rotulo: 'Ligação' },
  { valor: 'whatsapp', rotulo: 'WhatsApp' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'reuniao', rotulo: 'Reunião' },
  { valor: 'tarefa', rotulo: 'Tarefa' },
]
export const rotuloDoTipo = (t: TipoAtividade) => TIPOS.find((x) => x.valor === t)?.rotulo ?? t

// Brazil has had no daylight saving time since 2019: America/Sao_Paulo is a fixed UTC-3.
const FUSO = '-03:00'
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

// "2026-10-17T14:30" (a datetime-local input) -> absolute ISO instant, or null when it is not a real date/time.
export function dataHoraLocalParaIso(local: string): string | null {
  const m = LOCAL.exec(local)
  if (!m) return null
  const [, a, mes, d, h, min] = m
  if (Number(h) > 23 || Number(min) > 59) return null
  const data = new Date(`${a}-${mes}-${d}T${h}:${min}:00${FUSO}`)
  if (Number.isNaN(data.getTime())) return null
  // reject dates that JS silently rolls over (e.g. Feb 31)
  return diaNoBrasil(data.toISOString()) === `${a}-${mes}-${d}` ? data.toISOString() : null
}

const FORMATO_LOCAL = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

// Absolute instant -> value for <input type="datetime-local"> in Brazil time ('' when invalid).
export function isoParaDataHoraLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = Object.fromEntries(FORMATO_LOCAL.formatToParts(d).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

const uuidOuNulo = (mensagem: string) =>
  z.string().trim().refine((v) => v === '' || z.uuid().safeParse(v).success, mensagem).transform((v) => (v === '' ? null : v))

export const atividadeSchema = z
  .object({
    tipo: z.enum(TIPOS.map((t) => t.valor) as [TipoAtividade, ...TipoAtividade[]], 'Escolha o tipo da atividade.'),
    titulo: z.string().trim().min(1, 'Digite o título da atividade.').max(200, 'O título pode ter no máximo 200 caracteres.'),
    quando: z.string().trim().refine((v) => dataHoraLocalParaIso(v) !== null, 'Escolha uma data e hora válidas.'),
    status: z.enum(['pendente', 'feito'], 'Escolha se está pendente ou feita.'),
    responsavel: uuidOuNulo('Escolha o responsável na lista.'),
    negociacao: uuidOuNulo('Escolha a negociação na lista.'),
    motivo: z.string().trim().max(200, 'O motivo pode ter no máximo 200 caracteres.').transform((v) => (v === '' ? null : v)),
  })
  .transform((v) => ({
    tipo: v.tipo,
    titulo: v.titulo,
    quando: dataHoraLocalParaIso(v.quando) as string,
    status: v.status,
    responsavel_id: v.responsavel,
    negociacao_id: v.negociacao,
    motivo: v.motivo,
  }))

export type NotaDaLinha = { id: string; texto: string; autor: string; criada_em: string }
export type AtividadeDaLinha = {
  id: string; tipo: TipoAtividade; titulo: string; quando: string; status: StatusAtividade; feito_em: string | null; responsavel_nome: string | null
}
export type ItemDaLinha =
  | ({ tipo: 'anotacao'; data: string } & NotaDaLinha)
  | ({ tipo: 'atividade'; data: string; tipoAtividade: TipoAtividade } & Omit<AtividadeDaLinha, 'tipo'>)

// Notes and activities in one feed, newest first. A done activity counts from the moment it was done;
// a pending one from its scheduled time (so upcoming ones sit on top).
export function montarLinhaDoTempo(notas: NotaDaLinha[], atividades: AtividadeDaLinha[]): ItemDaLinha[] {
  const itens: ItemDaLinha[] = [
    ...notas.map((n): ItemDaLinha => ({ ...n, tipo: 'anotacao', data: n.criada_em })),
    ...atividades.map(({ tipo, ...a }): ItemDaLinha => ({ ...a, tipo: 'atividade', tipoAtividade: tipo, data: a.status === 'feito' && a.feito_em ? a.feito_em : a.quando })),
  ]
  return itens.sort((a, b) => b.data.localeCompare(a.data))
}

export function textoUltimaInteracao(iso: string | null, hoje: string): string {
  if (!iso) return 'Nenhuma interação registrada'
  const dia = diaNoBrasil(iso)
  const dias = -diasAte(dia, hoje)
  const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`
  return `Última interação: ${formatarDataBr(dia)} (${quando})`
}

// A pending activity is late once its scheduled time has passed.
export function atrasadaAgora(status: StatusAtividade, quando: string, agoraIso: string): boolean {
  return status === 'pendente' && quando < agoraIso
}
