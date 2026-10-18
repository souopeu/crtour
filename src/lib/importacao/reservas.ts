import { z } from 'zod'
import { normalizarWhatsapp } from '@/lib/clientes/whatsapp'
import { reaisParaCentavos } from '@/lib/passeios/dinheiro'
import { normalizarCabecalho } from './colunas'
import { IMPORTACAO } from './config'
import { normalizarData } from './linhas'
import { lerTabela, vazia } from './planilha'

// Reservation import (R44–R47). Client, tour and departure must already exist: the sheet never creates them.
export type CampoReserva = 'whatsapp' | 'email' | 'passeio' | 'data' | 'pessoas' | 'total' | 'pago' | 'forma' | 'dataPagamento'
export type LinhaReserva = {
  linha: number; whatsapp: string | null; email: string | null; passeio: string; data: string; pessoas: number
  total: number | null; pago: number; forma: string | null; data_pagamento: string | null
}

const ALIASES: Record<CampoReserva, string[]> = {
  whatsapp: ['whatsapp do cliente', 'whatsapp', 'telefone', 'celular'],
  email: ['e-mail do cliente', 'email do cliente', 'e-mail', 'email'],
  passeio: ['passeio', 'nome do passeio'],
  data: ['data da saida', 'data', 'saida'],
  pessoas: ['pessoas', 'numero de pessoas', 'qtd de pessoas'],
  total: ['valor total', 'total'],
  pago: ['valor pago', 'pago', 'sinal'],
  forma: ['forma de pagamento', 'forma'],
  dataPagamento: ['data do pagamento', 'data pagamento'],
}
const POR_CABECALHO = new Map((Object.entries(ALIASES) as [CampoReserva, string[]][]).flatMap(([c, ns]) => ns.map((n) => [n, c] as const)))

export function mapearColunasReserva(cabecalhos: string[]):
  { ok: true; colunas: (CampoReserva | null)[]; ignoradas: string[] } | { ok: false; erro: string } {
  const colunas = cabecalhos.map((h) => POR_CABECALHO.get(normalizarCabecalho(h)) ?? null)
  if (!colunas.includes('whatsapp') && !colunas.includes('email')) return { ok: false, erro: 'Falta a coluna do cliente: "WhatsApp do cliente" ou "E-mail do cliente".' }
  for (const [campo, nome] of [['passeio', 'Passeio'], ['data', 'Data da saída'], ['pessoas', 'Pessoas']] as const) {
    if (!colunas.includes(campo)) return { ok: false, erro: `Falta a coluna "${nome}".` }
  }
  return { ok: true, colunas, ignoradas: cabecalhos.filter((h, i) => colunas[i] === null && h.trim() !== '') }
}

const texto = (v: unknown) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim())
// Excel numbers come as numbers (1234.5); typed values as Brazilian text ("1.234,50").
const dinheiro = (v: unknown): number | null | undefined => {
  if (texto(v) === '') return undefined
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 && v <= 9_999_999 ? Math.round(v * 100) : null
  return reaisParaCentavos(texto(v))
}
const FORMAS: Record<string, string> = { pix: 'pix', dinheiro: 'dinheiro', cartao: 'cartao', 'cartao de credito': 'cartao', 'cartao de debito': 'cartao', transferencia: 'transferencia', ted: 'transferencia', outro: 'outro' }

export function converterLinhaReserva(numero: number, c: Partial<Record<CampoReserva, unknown>>, hoje: string):
  { ok: true; linha: LinhaReserva } | { ok: false; linha: number; erros: string[] } {
  const erros: string[] = []
  const zap = normalizarWhatsapp(texto(c.whatsapp))
  if (!zap.ok) erros.push('WhatsApp inválido: use DDD + número, ex.: (11) 99999-0001.')
  const emailTxt = texto(c.email).toLowerCase()
  const emailOk = emailTxt === '' || z.email().safeParse(emailTxt).success
  if (!emailOk) erros.push('E-mail inválido.')
  if (zap.ok && !zap.valor && emailTxt === '') erros.push('Informe o WhatsApp ou o e-mail do cliente (o cliente precisa estar cadastrado).')

  const passeio = texto(c.passeio).replace(/\s+/g, ' ')
  if (passeio === '' || passeio.length > 120) erros.push('Informe o passeio, com o nome igual ao cadastrado.')
  const data = normalizarData(c.data)
  if (!data) erros.push('Data da saída: use uma data válida (dd/mm/aaaa).')
  const pessoas = Number(texto(c.pessoas))
  if (!Number.isInteger(pessoas) || pessoas < 1 || pessoas > 500) erros.push('Pessoas: use um número inteiro de 1 a 500.')

  const total = dinheiro(c.total)
  if (total === null) erros.push('Valor total inválido: use, por exemplo, 2.000,00.')
  const pago = dinheiro(c.pago)
  if (pago === null) erros.push('Valor pago inválido: use, por exemplo, 500,00.')

  const formaTxt = texto(c.forma)
  const forma = formaTxt === '' ? null : (FORMAS[normalizarCabecalho(formaTxt)] ?? undefined)
  if (forma === undefined) erros.push('Forma de pagamento: use Pix, Dinheiro, Cartão, Transferência ou Outro.')
  const dataPag = normalizarData(c.dataPagamento)
  if (dataPag === null) erros.push('Data do pagamento: use uma data válida (dd/mm/aaaa).')
  else if (dataPag && dataPag > hoje) erros.push('Data do pagamento não pode ser no futuro.')
  if (pago) {
    if (forma === null) erros.push('Valor pago informado: preencha a forma de pagamento.')
    if (!dataPag) erros.push('Valor pago informado: preencha a data do pagamento.')
  }

  if (erros.length > 0) return { ok: false, linha: numero, erros }
  return { ok: true, linha: {
    linha: numero, whatsapp: zap.ok ? zap.valor : null, email: emailTxt || null, passeio, data: data as string, pessoas,
    total: total ?? null, pago: pago ?? 0, forma: forma ?? null, data_pagamento: dataPag || null,
  } }
}

export type Resolucao = { linha: number; saida_id: string | null; vagas_livres: number | null; problema: string | null }

// Preview: rows that will not fit are flagged in sheet order (the import refuses them and keeps the rest).
export function resumirConferencia(linhas: LinhaReserva[], resolucoes: Resolucao[]) {
  const porLinha = new Map(resolucoes.map((r) => [r.linha, r]))
  const usadas = new Map<string, number>()
  const semVagas: number[] = []
  const problemas: { linha: number; mensagem: string }[] = []
  let prontas = 0
  for (const l of linhas) {
    const r = porLinha.get(l.linha)
    if (!r || r.problema || !r.saida_id) { problemas.push({ linha: l.linha, mensagem: mensagemDoProblema(r?.problema ?? 'desconhecido') }); continue }
    const ocupadas = (usadas.get(r.saida_id) ?? 0) + l.pessoas
    if (ocupadas > (r.vagas_livres ?? 0)) { semVagas.push(l.linha); continue }
    usadas.set(r.saida_id, ocupadas)
    prontas++
  }
  return { prontas, semVagas, problemas }
}

const PROBLEMAS: Record<string, string> = {
  cliente_nao_encontrado: 'Cliente não encontrado: importe ou cadastre o cliente antes (mesmo WhatsApp ou e-mail).',
  cliente_ambiguo: 'Mais de um cliente com esse WhatsApp ou e-mail: corrija os cadastros repetidos antes.',
  passeio_nao_encontrado: 'Passeio não encontrado: o nome precisa ser igual ao cadastrado em Passeios.',
  passeio_ambiguo: 'Há dois passeios com esse nome: renomeie um deles antes.',
  saida_nao_encontrada: 'Não há saída desse passeio nessa data: crie a saída antes.',
  saida_fechada: 'A saída dessa data está encerrada para reservas.',
  CR001: 'Sem vagas suficientes nessa saída.',
  CR002: 'A saída não está aberta para reservas.',
  CR007: 'O valor pago é maior que o total da reserva.',
  '22008': 'Data do pagamento não pode ser no futuro.',
  '23514': 'Algum valor está fora do permitido (pessoas, valor ou data).',
}
export const mensagemDoProblema = (codigo: string) => PROBLEMAS[codigo] ?? `Não foi possível importar esta linha (código ${codigo}).`

export type LeituraReservas =
  | { ok: true; validas: LinhaReserva[]; erros: { linha: number; mensagens: string[] }[]; ignoradas: string[]; total: number }
  | { ok: false; erro: string }

export async function lerPlanilhaReservas(buffer: Buffer, nomeArquivo: string, hoje: string): Promise<LeituraReservas> {
  const t = await lerTabela(buffer, nomeArquivo, 'Reservas')
  if (!t.ok) return t
  const m = mapearColunasReserva(t.cabecalhos)
  if (!m.ok) return m
  const validas: LinhaReserva[] = []
  const erros: { linha: number; mensagens: string[] }[] = []
  let total = 0
  for (const { numero, valores } of t.corpo) {
    if (valores.every(vazia)) continue
    if (++total > IMPORTACAO.arquivo.maxLinhas) return { ok: false, erro: `A planilha pode ter no máximo ${IMPORTACAO.arquivo.maxLinhas.toLocaleString('pt-BR')} linhas.` }
    const celulas: Partial<Record<CampoReserva, unknown>> = {}
    m.colunas.forEach((campo, i) => { if (campo && !vazia(valores[i]) && celulas[campo] === undefined) celulas[campo] = valores[i] })
    const r = converterLinhaReserva(numero, celulas, hoje)
    if (r.ok) validas.push(r.linha)
    else erros.push({ linha: r.linha, mensagens: r.erros })
  }
  if (total === 0) return { ok: false, erro: 'A planilha não tem nenhuma reserva (só o cabeçalho ou linhas vazias).' }
  return { ok: true, validas, erros, ignoradas: m.ignoradas, total }
}
