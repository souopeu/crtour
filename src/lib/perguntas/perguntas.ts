import { z } from 'zod'

// E11-3 (R160–R161): questions before the tour. The answer rules match public.responder_reserva.
export const TIPOS_PERGUNTA = { texto: 'Texto curto', sim_nao: 'Sim ou não', escolha: 'Escolha entre opções', numero: 'Número' } as const
export type TipoPergunta = keyof typeof TIPOS_PERGUNTA
export type Pergunta = { id: string; texto: string; tipo: TipoPergunta; opcoes: string[] | null; obrigatoria: boolean; por_passageiro: boolean }
export const MAX_PERGUNTAS = 10
const PREFIXO = 'resposta:'
const NUMERO = /^-?\d{1,9}([.,]\d{1,3})?$/

export const perguntaSchema = z
  .object({
    texto: z.string().trim().min(1, 'Digite a pergunta.').max(200, 'A pergunta pode ter no máximo 200 caracteres.'),
    tipo: z.enum(['texto', 'sim_nao', 'escolha', 'numero'], 'Escolha o tipo de resposta.'),
    opcoes: z.string().default(''),
    obrigatoria: z.string().default(''),
    por_passageiro: z.string().default(''),
  })
  .transform((v) => ({ ...v, lista: [...new Set(v.opcoes.split('\n').map((o) => o.trim()).filter(Boolean))] }))
  .refine((v) => v.tipo !== 'escolha' || (v.lista.length >= 2 && v.lista.length <= 10 && v.lista.every((o) => o.length <= 80)),
    { path: ['opcoes'], message: 'Escreva de 2 a 10 opções, uma por linha.' })
  .transform((v) => ({
    texto: v.texto, tipo: v.tipo, opcoes: v.tipo === 'escolha' ? v.lista : null,
    obrigatoria: v.obrigatoria === '1', por_passageiro: v.por_passageiro === '1',
  }))

export function respostaValida(p: Pick<Pergunta, 'tipo' | 'opcoes'>, resposta: string): boolean {
  if (resposta.length > 500) return false
  if (p.tipo === 'sim_nao') return resposta === 'Sim' || resposta === 'Não'
  if (p.tipo === 'escolha') return (p.opcoes ?? []).includes(resposta)
  if (p.tipo === 'numero') return NUMERO.test(resposta)
  return true
}

const MENSAGEM: Record<TipoPergunta, string> = {
  texto: 'A resposta pode ter no máximo 500 caracteres.', sim_nao: 'Escolha Sim ou Não.', escolha: 'Escolha uma das opções.', numero: 'Digite só o número.',
}

export const campoResposta = (pergunta: string, lugar?: number) => `${PREFIXO}${pergunta}${lugar ? `:${lugar}` : ''}`

export type Resposta = { pergunta: string; lugar?: number; resposta: string }

// Form fields "resposta:<pergunta>[:<lugar>]". Unknown questions and places beyond the people are ignored.
export function lerRespostas(campos: Iterable<[string, FormDataEntryValue]>, perguntas: Pergunta[], pessoas: number):
  { ok: true; respostas: Resposta[] } | { ok: false; campos: Record<string, string[]> } {
  const porId = new Map(perguntas.map((p) => [p.id, p]))
  const respostas: Resposta[] = []
  const erros: Record<string, string[]> = {}
  for (const [nome, valor] of campos) {
    if (!nome.startsWith(PREFIXO)) continue
    const [id, lugarTexto] = nome.slice(PREFIXO.length).split(':')
    const p = porId.get(id)
    const lugar = lugarTexto === undefined ? undefined : Number(lugarTexto)
    if (!p || p.por_passageiro !== (lugar !== undefined) || (lugar !== undefined && !(Number.isInteger(lugar) && lugar >= 1 && lugar <= pessoas))) continue
    const resposta = String(valor).trim()
    if (resposta !== '' && !respostaValida(p, resposta)) erros[nome] = [MENSAGEM[p.tipo]]
    respostas.push(lugar === undefined ? { pergunta: id, resposta } : { pergunta: id, lugar, resposta })
  }
  return Object.keys(erros).length ? { ok: false, campos: erros } : { ok: true, respostas }
}

// Required answers still missing: one per reservation, or one per person for per-passenger questions.
export function pendentes(perguntas: Pergunta[], respostas: { pergunta_id: string | null; lugar: number | null }[], pessoas: number): number {
  const dadas = new Set(respostas.map((r) => `${r.pergunta_id}:${r.lugar ?? ''}`))
  let faltam = 0
  for (const p of perguntas.filter((q) => q.obrigatoria)) {
    if (!p.por_passageiro) faltam += dadas.has(`${p.id}:`) ? 0 : 1
    else for (let l = 1; l <= pessoas; l++) faltam += dadas.has(`${p.id}:${l}`) ? 0 : 1
  }
  return faltam
}

// One value per question for a line of the passenger list: per-reservation answers on the responsible line (place 1).
export function respostasPorLinha(perguntas: Pergunta[], respostas: { reserva_id: string; pergunta_id: string | null; lugar: number | null; resposta: string }[]) {
  const mapa = new Map(respostas.map((r) => [`${r.reserva_id}:${r.pergunta_id}:${r.lugar ?? ''}`, r.resposta]))
  return (linha: { reserva_id: string; lugar: number }) => perguntas.map((p) =>
    p.por_passageiro ? (mapa.get(`${linha.reserva_id}:${p.id}:${linha.lugar}`) ?? '')
      : linha.lugar === 1 ? (mapa.get(`${linha.reserva_id}:${p.id}:`) ?? '') : '')
}
