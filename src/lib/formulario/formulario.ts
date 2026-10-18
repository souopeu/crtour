import { createHash } from 'node:crypto'
import { z } from 'zod'
import { normalizarWhatsapp } from '@/lib/clientes/whatsapp'
import { ORIGENS } from '@/lib/clientes/schema'
import { FORMULARIO } from './config'

export type Envio = { nome: string; whatsapp: string; destino: string | null; pessoas: number | null; data: string | null; mensagem: string | null; aceita: boolean }
export type ResultadoEnvio = { ok: true; dados: Envio } | { ok: false; robo?: true; campos: Partial<Record<keyof Envio, string>> }

const texto = (fd: FormData, nome: string) => String(fd.get(nome) ?? '').trim()
const opcional = (v: string) => (v === '' ? null : v)

const schema = z.object({
  nome: z.string().min(1, 'Digite seu nome.').max(FORMULARIO.NOME_MAX, 'O nome pode ter no máximo 200 caracteres.'),
  destino: z.string().max(FORMULARIO.DESTINO_MAX, 'Use no máximo 120 caracteres.').transform(opcional),
  pessoas: z.string().transform((v, ctx) => {
    if (v === '') return null
    const n = Number(v)
    if (!Number.isInteger(n) || n < 1 || n > FORMULARIO.PESSOAS_MAX) { ctx.addIssue({ code: 'custom', message: 'Informe de 1 a 500 pessoas.' }); return z.NEVER }
    return n
  }),
  data: z.string().refine((v) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), 'Escolha uma data válida.').transform(opcional),
  mensagem: z.string().max(FORMULARIO.MENSAGEM_MAX, 'A mensagem pode ter no máximo 1000 caracteres.').transform(opcional),
})

// Reads and validates a submission. A filled bait field means a robot: refused without saying why.
export function lerEnvio(fd: FormData): ResultadoEnvio {
  if (texto(fd, FORMULARIO.CAMPO_ISCA) !== '') return { ok: false, robo: true, campos: {} }
  const whats = normalizarWhatsapp(texto(fd, 'whatsapp'))
  const r = schema.safeParse({ nome: texto(fd, 'nome'), destino: texto(fd, 'destino'), pessoas: texto(fd, 'pessoas'), data: texto(fd, 'data'), mensagem: texto(fd, 'mensagem') })
  const campos: Partial<Record<keyof Envio, string>> = {}
  if (!r.success) for (const i of r.error.issues) campos[i.path[0] as keyof Envio] ??= i.message
  if (!whats.ok || !whats.valor) campos.whatsapp = 'Digite um WhatsApp com DDD, como (11) 99999-0000.'
  if (!r.success || !whats.ok || !whats.valor) return { ok: false, campos }
  return { ok: true, dados: { ...r.data, whatsapp: whats.valor, aceita: fd.get('aceita') === 'on' } }
}

type Parametros = Record<string, string | string[] | undefined>
const um = (v: string | string[] | undefined) => (typeof v === 'string' ? v.trim() : '')
const tag = (v: string | string[] | undefined) => opcional(um(v).slice(0, FORMULARIO.UTM_MAX))

// R66: the link says where the visitor came from (?o=instagram) and which campaign (utm_*). Unknown origin = site.
export function lerOrigemDoLink(p: Parametros) {
  const o = um(p.o)
  return {
    origem: (ORIGENS as readonly string[]).includes(o) ? o : 'site',
    utmFonte: tag(p.utm_source),
    utmCampanha: tag(p.utm_campaign),
  }
}

// R68: the rate limit counts visitors by a hash of their address (salted per form); the address is never stored.
export const hashVisitante = (ip: string, codigo: string) => createHash('sha256').update(`${codigo}:${ip}`).digest('hex')

export function linkDoFormulario(site: string, codigo: string, origem: string | null): string {
  return `${site}/f/${codigo}${origem ? `?o=${encodeURIComponent(origem)}` : ''}`
}
