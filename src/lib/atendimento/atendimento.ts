import { z } from 'zod'
import { diaNoBrasil, formatarDataBr } from '@/lib/formato'
import { dentroDaJanela } from '@/lib/whatsapp/whatsapp'
import { ATENDIMENTO } from './config'

export const ABAS = [
  { valor: 'novos', rotulo: 'Novos' },
  { valor: 'meus', rotulo: 'Meus' },
  { valor: 'outros', rotulo: 'Outros' },
  { valor: 'arquivadas', rotulo: 'Arquivadas' },
] as const
export type Aba = (typeof ABAS)[number]['valor']

export type FiltrosAtendimento = { aba: Aba; q: string; etiqueta: string | null; conversa: string | null }

const um = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')
const uuidOuNulo = (v: string) => (z.uuid().safeParse(v).success ? v : null)

// R102: tab, search, tag and open conversation from the URL. "Outros" is the owner's only (a seller falls back to Novos).
export function lerFiltrosAtendimento(sp: Record<string, string | string[] | undefined>, ehDono: boolean): FiltrosAtendimento {
  const pedida = ABAS.find((a) => a.valor === um(sp.aba))?.valor ?? 'novos'
  return {
    aba: pedida === 'outros' && !ehDono ? 'novos' : pedida,
    q: um(sp.q).trim().slice(0, ATENDIMENTO.MAX_BUSCA),
    etiqueta: uuidOuNulo(um(sp.etiqueta)),
    conversa: uuidOuNulo(um(sp.c)),
  }
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MINUTO = 60_000
const HORA = 60 * MINUTO
const SEMANA_DIAS = 7

const diaUtc = (dia: string) => Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10)))
const diasEntre = (de: string, ate: string) => Math.round((diaUtc(ate) - diaUtc(de)) / (24 * HORA))
const plural = (n: number, um: string, varios: string) => `há ${n} ${n === 1 ? um : varios}`

// R103: "há 15 minutos", "ontem", "terça", "02/10" (Brazil calendar days).
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const ms = agora.getTime() - new Date(iso).getTime()
  const dia = diaNoBrasil(iso)
  const hoje = diaNoBrasil(agora.toISOString())
  if (ms < MINUTO) return 'há poucos segundos'
  if (ms < HORA) return plural(Math.floor(ms / MINUTO), 'minuto', 'minutos')
  const dias = diasEntre(dia, hoje)
  if (dias === 0) return plural(Math.floor(ms / HORA), 'hora', 'horas')
  if (dias === 1) return 'ontem'
  if (dias < SEMANA_DIAS) return DIAS_SEMANA[new Date(diaUtc(dia)).getUTCDay()]
  const data = formatarDataBr(dia)
  return dia.slice(0, 4) === hoje.slice(0, 4) ? data.slice(0, 5) : data
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (partes[0][0] + ultima).toUpperCase()
}

type Direcao = 'recebida' | 'enviada'
type SituacaoMsg = 'recebida' | 'enviada' | 'entregue' | 'lida' | 'falhou'

// R103: the tick shown after a sent message, with words for screen readers.
export function marcaDeEnvio(direcao: Direcao, situacao: SituacaoMsg): { simbolo: string; texto: string } | null {
  if (direcao === 'recebida') return null
  if (situacao === 'falhou') return { simbolo: '!', texto: 'não enviada' }
  if (situacao === 'entregue' || situacao === 'lida') return { simbolo: '✓✓', texto: situacao }
  return { simbolo: '✓', texto: 'enviada' }
}

export type EventoConversa = {
  tipo: 'assumiu' | 'transferiu' | 'arquivou' | 'reabriu' | 'etiqueta_adicionada' | 'etiqueta_removida' | 'chegou_por_anuncio'
  autor_id: string | null; para_id: string | null; detalhe: string | null
}

const PESSOA_REMOVIDA = 'Pessoa removida'

// R104: one line per timeline event, in the style of the references (Helena Fig. 7 and 8).
export function textoDoEvento(e: EventoConversa, nomes: Map<string, string>): string {
  const quem = (id: string | null) => (id ? nomes.get(id) ?? PESSOA_REMOVIDA : 'O sistema')
  switch (e.tipo) {
    case 'assumiu': return `${quem(e.autor_id)} assumiu o atendimento`
    case 'transferiu': return `${quem(e.autor_id)} passou o atendimento para ${quem(e.para_id)}`
    case 'arquivou': return `${quem(e.autor_id)} arquivou o atendimento`
    case 'reabriu': return 'Reaberto: nova mensagem do cliente'
    case 'etiqueta_adicionada': return `Etiqueta ${e.detalhe ?? ''} adicionada`
    case 'etiqueta_removida': return `Etiqueta ${e.detalhe ?? ''} removida`
    case 'chegou_por_anuncio': return `Chegou pelo anúncio "${e.detalhe ?? ''}"`
  }
}

type ComData = { id: string; em: string }

// R104: messages and events together, oldest first, grouped by Brazil day ("Hoje", "Ontem", "01/10/2026").
export function linhaDoTempo<M extends ComData, E extends ComData>(mensagens: M[], eventos: E[], agora: Date = new Date()) {
  const hoje = diaNoBrasil(agora.toISOString())
  const todos: (M | E)[] = [...mensagens, ...eventos].sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime())
  const dias: { dia: string; rotulo: string; itens: (M | E)[] }[] = []
  for (const item of todos) {
    const dia = diaNoBrasil(item.em)
    const ultimo = dias[dias.length - 1]
    if (ultimo?.dia === dia) ultimo.itens.push(item)
    else dias.push({ dia, rotulo: dia === hoje ? 'Hoje' : diasEntre(dia, hoje) === 1 ? 'Ontem' : formatarDataBr(dia), itens: [item] })
  }
  return dias
}

// Links of the screen keep the other filters: changing tab or search closes the open conversation, opening one keeps them.
export function hrefAtendimento(f: FiltrosAtendimento, m: Partial<FiltrosAtendimento>): string {
  const n = { ...f, ...m }
  const p = new URLSearchParams()
  if (n.aba !== 'novos') p.set('aba', n.aba)
  if (n.q) p.set('q', n.q)
  if (n.etiqueta) p.set('etiqueta', n.etiqueta)
  if (n.conversa) p.set('c', n.conversa)
  const qs = p.toString()
  return qs ? `/atendimento?${qs}` : '/atendimento'
}

type RegraEnvio = { temProvedor: boolean; consentimento: 'aceitou' | 'nao_informado' | 'pediu_saida'; ultimaRecebidaEm: string | null; agora?: Date }

// R105: free text only inside 24 h of the client's last message, never to who asked to leave, only with a provider.
// The server action applies the same rule before sending; the screen uses it to explain why the field is off.
export function regraDeEnvio(r: RegraEnvio): { ok: true } | { ok: false; motivo: string } {
  if (!r.temProvedor) return { ok: false, motivo: 'O envio pelo crTOUR ainda não está ligado. Por enquanto, responda pelo WhatsApp.' }
  if (r.consentimento === 'pediu_saida') return { ok: false, motivo: 'Este cliente pediu para não receber mensagens.' }
  if (!dentroDaJanela(r.ultimaRecebidaEm, r.agora)) {
    return { ok: false, motivo: 'Passou de 24 h desde a última mensagem do cliente: só dá para enviar modelo aprovado.' }
  }
  return { ok: true }
}
