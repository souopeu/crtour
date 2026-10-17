import { z } from 'zod'
import { primeiroNome } from '@/lib/clientes/whatsappLink'
import { ROTULO_ORIGEM } from '@/lib/clientes/rotulos'
import { ORIGENS } from '@/lib/clientes/schema'
import type { Origem } from '@/lib/clientes/filtros'
import { MOTIVOS, rotuloDoMotivo, type Motivo } from '@/lib/negociacoes/negociacoes'

// Same keys as the jsonb read by public.clientes_do_segmento.
export type Criterios = Partial<{
  etiqueta: string; destino: string; origem: Origem; cidade: string; aniversarioMes: number
  semContatoDias: number; motivoPerda: Motivo; passaporteMeses: number
}>

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const texto = (max: number) => z.string().trim().min(1).max(max)
const inteiro = (min: number, max: number) =>
  z.string().trim().regex(/^\d+$/).transform(Number).pipe(z.number().min(min).max(max))
const CAMPOS = {
  etiqueta: z.uuid(),
  destino: texto(80),
  origem: z.enum(ORIGENS),
  cidade: texto(120),
  aniversarioMes: inteiro(1, 12),
  semContatoDias: inteiro(1, 365),
  motivoPerda: z.enum(MOTIVOS.map((m) => m.valor) as [Motivo, ...Motivo[]]),
  passaporteMeses: inteiro(1, 24),
} as const
const CHAVES = Object.keys(CAMPOS) as (keyof Criterios)[]

// Anything invalid is ignored (URL or saved form), never an error page.
export function lerCriterios(p: Record<string, unknown>): Criterios {
  const c: Record<string, unknown> = {}
  for (const chave of CHAVES) {
    const bruto = p[chave]
    const v = typeof bruto === 'number' ? String(bruto) : bruto // saved criteria come back from jsonb with numbers
    if (typeof v !== 'string') continue
    const r = CAMPOS[chave].safeParse(v)
    if (r.success) c[chave] = r.data
  }
  return c as Criterios
}

export function criteriosParaQuery(c: Criterios): string {
  const q = new URLSearchParams()
  for (const chave of CHAVES) if (c[chave] !== undefined) q.set(chave, String(c[chave]))
  return q.toString()
}

export function descreverCriterios(c: Criterios, etiquetas: Map<string, string>): string[] {
  const linhas = [
    c.etiqueta && `Etiqueta: ${etiquetas.get(c.etiqueta) ?? '(apagada)'}`,
    c.destino && `Destino de interesse: ${c.destino}`,
    c.origem && `Como conheceu: ${ROTULO_ORIGEM[c.origem]}`,
    c.cidade && `Cidade: ${c.cidade}`,
    c.aniversarioMes && `Aniversário em ${MESES[c.aniversarioMes - 1]}`,
    c.semContatoDias && `Sem contato há ${c.semContatoDias} dias ou mais`,
    c.motivoPerda && `Perdeu negociação por: ${rotuloDoMotivo(c.motivoPerda)}`,
    c.passaporteMeses && `Passaporte vence em até ${c.passaporteMeses} ${c.passaporteMeses === 1 ? 'mês' : 'meses'} (ou já venceu)`,
  ].filter((l): l is string => Boolean(l))
  return linhas.length ? linhas : ['Todos os clientes']
}

// {nome} = first name; {destino} = the matching destination, or a neutral phrase.
export function aplicarModelo(modelo: string, cliente: { nome: string; destino: string | null }): string {
  return modelo.replaceAll('{nome}', primeiroNome(cliente.nome)).replaceAll('{destino}', cliente.destino || 'sua próxima viagem')
}

type ItemFila = { id: string; whatsapp: string | null; consentimento_whatsapp: string }

// Only consent "aceitou" with a number becomes a button (the database refuses the rest anyway).
export function separarFila<T extends ItemFila>(clientes: T[], chamados: Set<string>) {
  const r = { paraChamar: [] as T[], jaChamados: [] as T[], semConsentimento: [] as T[], semNumero: [] as T[] }
  for (const c of clientes) {
    if (chamados.has(c.id)) r.jaChamados.push(c)
    else if (c.consentimento_whatsapp !== 'aceitou') r.semConsentimento.push(c)
    else if (!c.whatsapp) r.semNumero.push(c)
    else r.paraChamar.push(c)
  }
  return r
}

export const segmentoSchema = z.object({
  nome: z.string().trim().min(1, 'Dê um nome ao segmento.').max(80, 'O nome pode ter no máximo 80 caracteres.'),
  mensagem: z.string().trim().max(1000, 'A mensagem pode ter no máximo 1000 caracteres.'),
})
