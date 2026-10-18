import { reaisParaCentavos } from '@/lib/passeios/dinheiro'
import { CAMPANHAS } from './config'

export const CANAIS = [
  { valor: 'meta', rotulo: 'Meta (Facebook e Instagram)', fonte: 'meta', midia: 'paid_social' },
  { valor: 'google', rotulo: 'Google Ads', fonte: 'google', midia: 'cpc' },
  { valor: 'outro', rotulo: 'Outro', fonte: 'outro', midia: 'outro' },
] as const
export type Canal = (typeof CANAIS)[number]['valor']
export const rotuloDoCanal = (c: string | null) => CANAIS.find((x) => x.valor === c)?.rotulo ?? 'Sem campanha cadastrada'

// The database matches a deal's utm_campanha to a campaign ignoring case and outer spaces.
export const chaveDaCampanha = (texto: string) => texto.trim().toLowerCase()

export type FormCampanha = { nome: string; canal: Canal; utm_campanha: string; inicio: string; fim: string | null; gasto_centavos: number }
type Campo = 'nome' | 'canal' | 'utm' | 'inicio' | 'fim' | 'gasto'
export type ResultadoForm = { ok: true; dados: FormCampanha } | { ok: false; campos: Partial<Record<Campo, string>> }

const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '').trim()
const dataReal = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso

export function lerFormCampanha(fd: FormData): ResultadoForm {
  const campos: Partial<Record<Campo, string>> = {}
  const nome = texto(fd, 'nome')
  const canal = texto(fd, 'canal')
  const utm = chaveDaCampanha(texto(fd, 'utm'))
  const inicio = texto(fd, 'inicio')
  const fim = texto(fd, 'fim')
  const gastoTexto = texto(fd, 'gasto')
  const gasto = gastoTexto === '' ? 0 : reaisParaCentavos(gastoTexto)
  if (nome.length < 1 || nome.length > CAMPANHAS.NOME_MAX) campos.nome = 'Digite o nome da campanha (até 120 caracteres).'
  if (!CANAIS.some((c) => c.valor === canal)) campos.canal = 'Escolha onde a campanha roda.'
  if (utm.length < 1 || utm.length > CAMPANHAS.UTM_MAX) campos.utm = 'Digite a etiqueta da campanha (até 100 caracteres), a mesma do link do anúncio.'
  if (!dataReal(inicio)) campos.inicio = 'Escolha a data de início.'
  if (fim !== '' && !dataReal(fim)) campos.fim = 'Escolha uma data válida.'
  else if (fim !== '' && dataReal(inicio) && fim < inicio) campos.fim = 'O fim não pode ser antes do início.'
  if (gasto === null) campos.gasto = 'Digite o gasto, como 1.500,00, ou deixe em branco.'
  if (Object.keys(campos).length > 0) return { ok: false, campos }
  return { ok: true, dados: { nome, canal: canal as Canal, utm_campanha: utm, inicio, fim: fim || null, gasto_centavos: gasto! } }
}

type Numeros = { leads: number; vendas: number; valor_vendido_centavos: number; gasto_centavos: number }
const dividir = (a: number, b: number) => (b > 0 ? a / b : null)

// R79: the report's numbers. Anything that would divide by zero is null, shown as a dash.
export function indicadores(n: Numeros) {
  const conversao = dividir(n.vendas * 100, n.leads)
  const custoPorLead = n.gasto_centavos > 0 ? dividir(n.gasto_centavos, n.leads) : null
  const custoPorVenda = n.gasto_centavos > 0 ? dividir(n.gasto_centavos, n.vendas) : null
  return {
    conversao: conversao === null ? null : Math.round(conversao * 10) / 10,
    custoPorLeadCentavos: custoPorLead === null ? null : Math.round(custoPorLead),
    custoPorVendaCentavos: custoPorVenda === null ? null : Math.round(custoPorVenda),
    retorno: dividir(n.valor_vendido_centavos, n.gasto_centavos) === null ? null : Math.round((n.valor_vendido_centavos / n.gasto_centavos) * 10) / 10,
  }
}

// The link to paste in the ad: the public form with the campaign tags, so every lead lands with its campaign.
export function linkDaCampanha(linkDoFormulario: string, canal: Canal, utm: string): string {
  const c = CANAIS.find((x) => x.valor === canal)!
  const p = new URLSearchParams({ o: 'anuncio', utm_source: c.fonte, utm_medium: c.midia, utm_campaign: utm })
  return `${linkDoFormulario}?${p.toString()}`
}

const menosDias = (iso: string, dias: number) => new Date(Date.parse(`${iso}T12:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10)

// Report period from the URL (?de=&ate=); anything missing or inverted falls back to the last 30 days.
export function periodoDoRelatorio(sp: { de?: string | string[]; ate?: string | string[] }, hoje: string) {
  const padrao = { de: menosDias(hoje, CAMPANHAS.PERIODO_PADRAO_DIAS), ate: hoje }
  const de = typeof sp.de === 'string' ? sp.de : ''
  const ate = typeof sp.ate === 'string' ? sp.ate : ''
  if (!dataReal(de) || !dataReal(ate) || de > ate) return padrao
  return { de, ate }
}

export type FormLink = { whatsapp: string; mensagem: string; ativo: boolean }

// R81: the owner's settings for the Google ad link. The number is normalized like every WhatsApp in the system.
export function lerFormLink(fd: FormData, normalizar: (v: string) => { ok: boolean; valor?: string | null }):
  { ok: true; dados: FormLink } | { ok: false; campos: Partial<Record<'whatsapp' | 'mensagem', string>> } {
  const campos: Partial<Record<'whatsapp' | 'mensagem', string>> = {}
  const w = normalizar(texto(fd, 'whatsapp'))
  const mensagem = texto(fd, 'mensagem')
  if (!w.ok || !w.valor) campos.whatsapp = 'Digite o WhatsApp da agência com DDD, como (11) 99999-0000.'
  if (mensagem.length < 1 || mensagem.length > MENSAGEM_LINK_MAX) campos.mensagem = 'Escreva a mensagem inicial (até 300 caracteres).'
  if (Object.keys(campos).length > 0) return { ok: false, campos }
  return { ok: true, dados: { whatsapp: w.valor!, mensagem, ativo: fd.get('ativo') === 'on' } }
}

// Google Ads: auto-tagging adds gclid by itself; the campaign tag goes in the final URL suffix.
export const SUFIXO_GOOGLE = 'utm_source=google&utm_medium=cpc&utm_campaign=nome-da-campanha'
const MENSAGEM_LINK_MAX = 300
