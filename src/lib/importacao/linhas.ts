import { clienteSchema, type DadosCliente } from '@/lib/clientes/schema'
import { normalizarCabecalho, type CampoImportacao } from './colunas'

export type CelulasLinha = Partial<Record<CampoImportacao, unknown>>
export type LinhaImportacao = DadosCliente & { linha: number; etiquetas: string[] }
export type ErroLinha = { campo: string; mensagem: string }
export type ResultadoLinha =
  | { ok: true; linha: LinhaImportacao }
  | { ok: false; linha: number; erros: ErroLinha[] }

const MAX_ETIQUETAS = 20
const MAX_NOME_ETIQUETA = 40

function texto(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).trim()
}

const dataReal = (iso: string) => new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso

// '' = empty cell, null = present but not a valid date.
export function normalizarData(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return ''
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    if (!(v >= 1 && v < 100000)) return null
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000).toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  if (s === '') return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return dataReal(s) ? s : null
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (br) {
    const iso = `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
    return dataReal(iso) ? iso : null
  }
  return null
}

const ORIGENS: Record<string, string> = {
  instagram: 'instagram', indicacao: 'indicacao', anuncio: 'anuncio', site: 'site', outro: 'outro',
}
const CONSENTIMENTOS: Record<string, string> = {
  'aceitou': 'aceitou', 'sim': 'aceitou', 'aceita': 'aceitou',
  'nao informado': 'nao_informado',
  'pediu para sair': 'pediu_saida', 'pediu saida': 'pediu_saida', 'pediu para nao receber': 'pediu_saida',
}

function etiquetasDe(v: unknown): { lista: string[]; erro?: string } {
  const vistos = new Set<string>()
  const lista = texto(v)
    .split(/[,;\n]/)
    .map((t) => t.trim().replace(/\s+/g, ' '))
    .filter((t) => {
      const chave = t.toLowerCase()
      if (t === '' || vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
  if (lista.length > MAX_ETIQUETAS) return { lista: [], erro: `Use no máximo ${MAX_ETIQUETAS} etiquetas por cliente.` }
  if (lista.some((t) => t.length > MAX_NOME_ETIQUETA)) {
    return { lista: [], erro: `Cada etiqueta pode ter no máximo ${MAX_NOME_ETIQUETA} caracteres.` }
  }
  return { lista }
}

export function converterLinha(numero: number, c: CelulasLinha): ResultadoLinha {
  const erros: ErroLinha[] = []

  const aniversario = normalizarData(c.aniversario)
  if (aniversario === null) erros.push({ campo: 'aniversario', mensagem: 'Aniversário: use uma data válida (dd/mm/aaaa).' })
  const passaporte = normalizarData(c.passaporteValidade)
  if (passaporte === null) erros.push({ campo: 'passaporteValidade', mensagem: 'Validade do passaporte: use uma data válida (dd/mm/aaaa).' })

  const origemTxt = texto(c.origem)
  const origem = origemTxt === '' ? '' : ORIGENS[normalizarCabecalho(origemTxt)]
  if (origem === undefined) erros.push({ campo: 'origem', mensagem: 'Origem inválida: use Instagram, Indicação, Anúncio, Site ou Outro.' })

  const consTxt = texto(c.consentimento)
  const consentimento = consTxt === '' ? 'nao_informado' : CONSENTIMENTOS[normalizarCabecalho(consTxt)]
  if (consentimento === undefined) {
    erros.push({ campo: 'consentimento', mensagem: 'Consentimento inválido: use Aceitou, Não informado ou Pediu para sair.' })
  }

  const tags = etiquetasDe(c.etiquetas)
  if (tags.erro) erros.push({ campo: 'etiquetas', mensagem: tags.erro })

  const r = clienteSchema.safeParse({
    nome: texto(c.nome),
    whatsapp: texto(c.whatsapp),
    email: texto(c.email),
    cidade: texto(c.cidade),
    aniversario: aniversario ?? '',
    origem: origem ?? '',
    destinos: texto(c.destinos),
    faixaOrcamento: texto(c.faixaOrcamento),
    qtdPessoas: texto(c.qtdPessoas),
    restricoes: texto(c.restricoes),
    passaporteValidade: passaporte ?? '',
    consentimento: consentimento ?? 'nao_informado',
  })
  if (!r.success) {
    for (const [campo, msgs] of Object.entries(r.error.flatten().fieldErrors)) {
      if (msgs?.[0]) erros.push({ campo, mensagem: msgs[0] })
    }
  }

  if (erros.length > 0 || !r.success) return { ok: false, linha: numero, erros }
  return { ok: true, linha: { linha: numero, ...r.data, etiquetas: tags.lista } }
}
