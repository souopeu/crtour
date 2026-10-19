import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import type { ProvedorWhatsapp } from './whatsapp'

// Spec 21 (W1): notices from Meta's official WhatsApp Cloud API in coexistence, turned into the internal notice format.
// Only what the read-only inbox needs: received messages (with ad data), statuses, echoes from the phone and history.

type Env = Record<string, string | undefined>

// R111: a notice counts only when signed with the app secret (header X-Hub-Signature-256). No secret, nothing passes.
export function assinaturaValida(corpo: string, cabecalho: string | null, segredo: string): boolean {
  if (!segredo || !cabecalho?.startsWith('sha256=')) return false
  const esperado = Buffer.from(createHmac('sha256', segredo).update(corpo).digest('hex'))
  const recebido = Buffer.from(cabecalho.slice('sha256='.length))
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
}

const ROTULOS: Record<string, string> = {
  image: '[foto]', audio: '[áudio]', video: '[vídeo]', document: '[documento]', sticker: '[figurinha]',
  location: '[localização]', contacts: '[contato]', media_placeholder: '[mídia]',
}

const msgSchema = z.object({
  from: z.string(), to: z.string().optional(), id: z.string(), timestamp: z.string(), type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  referral: z.object({ source_url: z.string().optional(), source_id: z.string().optional(), headline: z.string().optional(), ctwa_clid: z.string().optional() }).optional(),
})
type Msg = z.infer<typeof msgSchema>

const texto = (m: Msg) => m.text?.body ?? ROTULOS[m.type] ?? '[mensagem]'
const quando = (ts: string) => new Date(Number(ts) * 1000).toISOString()
const ouNulo = (v: string | undefined) => v ?? null
const STATUS: Record<string, 'enviada' | 'entregue' | 'lida' | 'falhou'> = { sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'falhou' }

const valorSchema = z.object({
  metadata: z.object({ phone_number_id: z.string() }),
  contacts: z.array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }).optional() })).optional(),
  messages: z.array(msgSchema).optional(),
  statuses: z.array(z.object({ id: z.string(), status: z.string() })).optional(),
  message_echoes: z.array(msgSchema).optional(),
  history: z.array(z.object({ threads: z.array(z.object({ id: z.string(), messages: z.array(msgSchema) })).optional() })).optional(),
})
const avisoSchema = z.object({ entry: z.array(z.object({ changes: z.array(z.object({ field: z.string(), value: z.unknown() })) })) })

function deUmaMudanca(field: string, bruto: unknown): unknown[] {
  const v = valorSchema.safeParse(bruto)
  if (!v.success) return []
  const conta = v.data.metadata.phone_number_id
  if (field === 'messages') {
    const nomes = new Map((v.data.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]))
    return [
      ...(v.data.messages ?? []).map((m) => ({
        tipo: 'mensagem', conta, idExterno: m.id, de: m.from, nome: nomes.get(m.from) ?? null, texto: texto(m), em: quando(m.timestamp),
        referencia: m.referral
          ? { anuncioId: ouNulo(m.referral.source_id), titulo: ouNulo(m.referral.headline), url: ouNulo(m.referral.source_url), cliqueId: ouNulo(m.referral.ctwa_clid) }
          : null,
      })),
      ...(v.data.statuses ?? []).filter((s) => STATUS[s.status]).map((s) => ({ tipo: 'status', idExterno: s.id, situacao: STATUS[s.status] })),
    ]
  }
  if (field === 'smb_message_echoes') {
    return (v.data.message_echoes ?? []).filter((m) => m.to).map((m) => ({ tipo: 'eco', conta, idExterno: m.id, para: m.to, texto: texto(m), em: quando(m.timestamp) }))
  }
  if (field === 'history') {
    // A history notice with only errors (e.g. 2593109: the business turned history sharing off) brings nothing.
    const conversas = (v.data.history ?? []).flatMap((h) => h.threads ?? []).map((t) => ({
      numero: t.id,
      mensagens: t.messages.map((m) => ({ id: m.id, doCliente: m.from === t.id, texto: texto(m), em: quando(m.timestamp) })),
    }))
    return conversas.length ? [{ tipo: 'historico', conta, conversas }] : []
  }
  return [] // account_update, smb_app_state_sync (contacts are not imported, R113) and anything else
}

export function lerAvisoMeta(json: unknown): unknown[] {
  const a = avisoSchema.safeParse(json)
  if (!a.success) return []
  return a.data.entry.flatMap((e) => e.changes.flatMap((c) => deUmaMudanca(c.field, c.value)))
}

// The "meta" provider. Read only in this phase: sending arrives with the connection (W2) and the "envio" mode.
export function provedorMeta(env: Env): ProvedorWhatsapp {
  const naoEnvia = async (): Promise<{ idExterno: string }> => { throw new Error('envio pela Meta desligado (só leitura)') }
  return {
    nome: 'meta',
    enviarTexto: naoEnvia,
    enviarModelo: naoEnvia,
    async validarAviso(corpo, cabecalhos) {
      if (!assinaturaValida(corpo, cabecalhos.get('x-hub-signature-256'), env.WHATSAPP_META_APP_SECRET ?? '')) return null
      return lerAvisoMeta(JSON.parse(corpo))
    },
  }
}

// R111: Meta's one-time check when the webhook is registered: echo the challenge only for our own verify token.
export function desafioDeVerificacao(busca: URLSearchParams, token: string | undefined): string | null {
  const desafio = busca.get('hub.challenge') ?? ''
  const ok = busca.get('hub.mode') === 'subscribe' && Boolean(token) && busca.get('hub.verify_token') === token && /^[\w-]{1,200}$/.test(desafio)
  return ok ? desafio : null
}
