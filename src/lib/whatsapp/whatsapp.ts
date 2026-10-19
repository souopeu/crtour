import { z } from 'zod'
import { provedorMeta } from './meta'

// E5-8 (R73): WhatsApp provider seam. With no provider configured the feature does not exist: no screen changes
// and the notice route answers 404. Plugging Meta's Cloud API or a BSP = adding it to PROVEDORES_WHATSAPP (E5-9).
const avisoSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('mensagem'), conta: z.string().min(1).max(200), idExterno: z.string().min(1).max(200),
    de: z.string().regex(/^\d{10,15}$/), nome: z.string().max(200).nullable(), texto: z.string().max(4096).nullable(), em: z.string(),
    // E7-3 (R82): set by the provider when the message came from a "click to WhatsApp" ad (Meta sends it with the first message).
    referencia: z.object({
      anuncioId: z.string().max(100).nullable(), titulo: z.string().max(300).nullable(), url: z.string().max(1000).nullable(), cliqueId: z.string().max(255).nullable(),
    }).nullable().optional(),
  }),
  z.object({ tipo: z.literal('status'), idExterno: z.string().min(1).max(200), situacao: z.enum(['enviada', 'entregue', 'lida', 'falhou']) }),
  // Spec 21, R112: what the agency sent from the WhatsApp Business app (coexistence).
  z.object({ tipo: z.literal('eco'), conta: z.string().min(1).max(200), idExterno: z.string().min(1).max(200), para: z.string().regex(/^\d{10,15}$/), texto: z.string().max(4096), em: z.string() }),
  // Spec 21, R113: the last 180 days, sent once after connecting.
  z.object({
    tipo: z.literal('historico'), conta: z.string().min(1).max(200),
    conversas: z.array(z.object({
      numero: z.string().regex(/^\d{10,15}$/),
      mensagens: z.array(z.object({ id: z.string().min(1).max(200), doCliente: z.boolean(), texto: z.string().max(4096), em: z.string() })),
    })),
  }),
])
export type AvisoWhatsapp = z.infer<typeof avisoSchema>

export interface ProvedorWhatsapp {
  nome: string
  enviarTexto(d: { para: string; texto: string }): Promise<{ idExterno: string }> // only inside the 24 h window
  enviarModelo(d: { para: string; modelo: string; variaveis: string[] }): Promise<{ idExterno: string }> // approved template, any time
  // Returns null when the notice is not authentic (bad signature). Never trust an unsigned notice.
  validarAviso(corpo: string, cabecalhos: Headers): Promise<unknown[] | null>
}

type Fabrica = (env: Record<string, string | undefined>) => ProvedorWhatsapp
export const PROVEDORES_WHATSAPP: Record<string, Fabrica> = { meta: provedorMeta } // spec 21: Meta's official Cloud API

export function obterProvedorWhatsapp(env: Record<string, string | undefined>, registro: Record<string, Fabrica> = PROVEDORES_WHATSAPP): ProvedorWhatsapp | null {
  const nome = env.WHATSAPP_PROVEDOR?.trim()
  const fabrica = nome ? registro[nome] : undefined
  return fabrica ? fabrica(env) : null
}

// The ad data as the database function expects it (p_referencia); null when the message did not come from an ad.
export function referenciaParaBanco(r: { anuncioId: string | null; titulo: string | null; url: string | null; cliqueId: string | null } | null | undefined) {
  return r ? { tipo: 'anuncio', anuncio_id: r.anuncioId, titulo: r.titulo, url: r.url, clique_id: r.cliqueId } : null
}

// Database refusals that retrying will not fix: answer 200 so the provider stops, and flag for a person.
const RECUSAS = new Set(['P0002', '22023'])
type Gravar = (a: AvisoWhatsapp & { provedor: string }) => Promise<{ ok: true } | { ok: false; codigo: string }>

export async function tratarAvisoWhatsapp(p: { provedor: ProvedorWhatsapp | null; nomeNaUrl: string; corpo: string; cabecalhos: Headers; gravar: Gravar }):
  Promise<{ status: number; conferir?: string }> {
  if (!p.provedor || p.provedor.nome !== p.nomeNaUrl) return { status: 404 }
  let brutos: unknown[] | null
  try {
    brutos = await p.provedor.validarAviso(p.corpo, p.cabecalhos)
  } catch {
    return { status: 400 }
  }
  if (!brutos) return { status: 401 }
  const avisos = z.array(avisoSchema).safeParse(brutos) // validated whole before storing anything
  if (!avisos.success) return { status: 400 }
  for (const a of avisos.data) {
    const r = await p.gravar({ ...a, provedor: p.provedor.nome })
    if (!r.ok) return RECUSAS.has(r.codigo) ? { status: 200, conferir: r.codigo } : { status: 500 }
  }
  return { status: 200 }
}

const JANELA_MS = 24 * 60 * 60 * 1000

// Free text is allowed only within 24 h of the client's last message; outside it, only approved templates.
export function dentroDaJanela(ultimaRecebidaEm: string | null, agora: Date = new Date()): boolean {
  return ultimaRecebidaEm !== null && agora.getTime() - Date.parse(ultimaRecebidaEm) <= JANELA_MS
}

// Which database function stores each notice, with its arguments (the route calls it with the service key).
export function chamadaDoAviso(a: AvisoWhatsapp & { provedor: string }): { funcao: string; args: Record<string, unknown> } {
  switch (a.tipo) {
    case 'mensagem':
      return { funcao: 'whatsapp_receber', args: { p_provedor: a.provedor, p_conta: a.conta, p_id_externo: a.idExterno, p_de: a.de, p_nome: a.nome, p_texto: a.texto, p_recebida_em: a.em, p_referencia: referenciaParaBanco(a.referencia) } }
    case 'status':
      return { funcao: 'whatsapp_status', args: { p_provedor: a.provedor, p_id_externo: a.idExterno, p_situacao: a.situacao } }
    case 'eco':
      return { funcao: 'whatsapp_registrar_eco', args: { p_provedor: a.provedor, p_conta: a.conta, p_id_externo: a.idExterno, p_para: a.para, p_texto: a.texto, p_enviada_em: a.em } }
    case 'historico':
      return {
        funcao: 'whatsapp_importar_historico',
        args: {
          p_provedor: a.provedor, p_conta: a.conta,
          p_conversas: a.conversas.map((c) => ({ numero: c.numero, nome: null, mensagens: c.mensagens.map((m) => ({ id: m.id, do_cliente: m.doCliente, texto: m.texto, em: m.em })) })),
        },
      }
  }
}
