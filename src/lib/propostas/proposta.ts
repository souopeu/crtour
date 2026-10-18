import { z } from 'zod'
import { primeiroNome } from '@/lib/clientes/whatsappLink'
import { formatarDataBr } from '@/lib/formato'
import { reaisParaCentavos } from '@/lib/passeios/dinheiro'

export type FormProposta = {
  pessoas: number; totalCentavos: number; sinalCentavos: number
  sinalAte: string | null; saldoAte: string | null; validade: string; observacoes: string | null
}
export type ResultadoForm = { ok: true; dados: FormProposta } | { ok: false; campos: Partial<Record<keyof FormProposta | 'total' | 'sinal', string>> }

const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '').trim()
const dataReal = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso

// R69: what the person types on the deal page. `hoje` is the Brazil date (the validity cannot start in the past).
export function lerFormProposta(fd: FormData, hoje: string): ResultadoForm {
  const campos: Partial<Record<keyof FormProposta | 'total' | 'sinal', string>> = {}
  const pessoas = Number(texto(fd, 'pessoas'))
  if (!Number.isInteger(pessoas) || pessoas < 1 || pessoas > 500) campos.pessoas = 'Informe de 1 a 500 pessoas.'
  const total = reaisParaCentavos(texto(fd, 'total'))
  if (total === null || total < 1) campos.total = 'Digite o valor total, como 9.000,00.'
  const sinalTexto = texto(fd, 'sinal')
  const sinal = sinalTexto === '' ? 0 : reaisParaCentavos(sinalTexto)
  if (sinal === null) campos.sinal = 'Digite o sinal, como 2.000,00, ou deixe em branco.'
  else if (total !== null && sinal > total) campos.sinal = 'O sinal não pode ser maior que o total.'
  const datas = { sinalAte: texto(fd, 'sinalAte'), saldoAte: texto(fd, 'saldoAte') }
  for (const [k, v] of Object.entries(datas)) if (v !== '' && !dataReal(v)) campos[k as 'sinalAte' | 'saldoAte'] = 'Escolha uma data válida.'
  const validade = texto(fd, 'validade')
  if (!dataReal(validade)) campos.validade = 'Escolha até quando a proposta vale.'
  else if (validade < hoje) campos.validade = 'A validade não pode ser antes de hoje.'
  const observacoes = z.string().max(1000).safeParse(texto(fd, 'observacoes'))
  if (!observacoes.success) campos.observacoes = 'Use no máximo 1000 caracteres.'
  if (Object.keys(campos).length > 0) return { ok: false, campos }
  return {
    ok: true,
    dados: {
      pessoas, totalCentavos: total!, sinalCentavos: sinal!, sinalAte: datas.sinalAte || null, saldoAte: datas.saldoAte || null,
      validade, observacoes: texto(fd, 'observacoes') || null,
    },
  }
}

export const dadosPropostaSchema = z.object({
  agencia: z.string(), cliente: z.string(), titulo: z.string(),
  passeio: z.string().nullable(), destino: z.string().nullable(), saida: z.string().nullable(),
  inclui: z.string().nullable(), naoInclui: z.string().nullable(),
  pessoas: z.number().int(), totalCentavos: z.number().int(), sinalCentavos: z.number().int(),
  sinalAte: z.string().nullable(), saldoAte: z.string().nullable(), observacoes: z.string().nullable(),
})
export type DadosProposta = z.infer<typeof dadosPropostaSchema>
type Contexto = Pick<DadosProposta, 'agencia' | 'cliente' | 'titulo' | 'passeio' | 'destino' | 'saida' | 'inclui' | 'naoInclui'>

// The frozen snapshot: names and texts as they are now, so later edits never change a sent proposal.
export function montarDados(f: FormProposta, c: Contexto): DadosProposta {
  return {
    ...c, pessoas: f.pessoas, totalCentavos: f.totalCentavos, sinalCentavos: f.sinalCentavos,
    sinalAte: f.sinalAte, saldoAte: f.saldoAte, observacoes: f.observacoes,
  }
}

export function resumoValores(d: Pick<DadosProposta, 'pessoas' | 'totalCentavos' | 'sinalCentavos'>) {
  return { porPessoaCentavos: Math.round(d.totalCentavos / d.pessoas), saldoCentavos: d.totalCentavos - d.sinalCentavos }
}

export function situacaoProposta(p: { validade: string; revogada_em: string | null }, hoje: string): 'valida' | 'vencida' | 'revogada' {
  if (p.revogada_em) return 'revogada'
  return p.validade >= hoje ? 'valida' : 'vencida'
}

export function mensagemProposta(nome: string, link: string, validade: string): string {
  const primeiro = primeiroNome(nome)
  return `Olá${primeiro ? `, ${primeiro}` : ''}! Segue a proposta da sua viagem: ${link} (válida até ${formatarDataBr(validade)}).`
}
