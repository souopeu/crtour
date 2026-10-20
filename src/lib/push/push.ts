import { textoDoAviso, type TipoAviso } from '@/lib/avisos/avisos'

// One row of pegar_pushes_pendentes: a notice × a device of someone who should get it.
export type LinhaPush = {
  aviso_id: string; tipo: TipoAviso; titulo: string; cliente_nome: string; valor_centavos: number
  negociacao_id: string | null; reserva_id: string | null; saida_id: string | null; cliente_id: string | null
  inscricao_id: string; endpoint: string; p256dh: string; auth: string
}

export type Inscricao = { endpoint: string; keys: { p256dh: string; auth: string } }
export type Enviar = (inscricao: Inscricao, corpo: string) => Promise<void>

// R131: same words as the bell; tapping opens the right screen (the service worker reads `url`).
export function conteudoDoPush(l: LinhaPush): { title: string; body: string; url: string; tag: string } {
  const t = textoDoAviso({
    id: l.aviso_id, tipo: l.tipo, titulo: l.titulo, cliente_nome: l.cliente_nome, valor_centavos: l.valor_centavos, por_nome: null,
    lido_em: null, criado_em: '', negociacao_id: l.negociacao_id, reserva_id: l.reserva_id, saida_id: l.saida_id,
    atividade: l.cliente_id ? { cliente_id: l.cliente_id } : null,
  })
  return { title: t.titulo, body: t.detalhe, url: t.href ?? '/avisos', tag: l.aviso_id }
}

// Sends every row; a device the push service no longer knows (404/410) is returned for removal. Other failures are only counted.
export async function enviarPushes(linhas: LinhaPush[], enviar: Enviar): Promise<{ enviados: number; falhas: number; sumidas: string[] }> {
  const r = await Promise.allSettled(linhas.map((l) =>
    enviar({ endpoint: l.endpoint, keys: { p256dh: l.p256dh, auth: l.auth } }, JSON.stringify(conteudoDoPush(l)))))
  const sumidas = new Set<string>()
  let falhas = 0
  r.forEach((x, i) => {
    if (x.status === 'fulfilled') return
    const codigo = (x.reason as { statusCode?: number } | null)?.statusCode
    if (codigo === 404 || codigo === 410) sumidas.add(linhas[i].inscricao_id)
    else falhas += 1
  })
  return { enviados: r.filter((x) => x.status === 'fulfilled').length, falhas, sumidas: [...sumidas] }
}

// VAPID keys: the public one also goes to the browser (NEXT_PUBLIC_), the private one never does.
export function configVapid(env: Record<string, string | undefined>) {
  const publica = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privada = env.VAPID_PRIVATE_KEY
  const contato = env.VAPID_SUBJECT
  return publica && privada && contato?.startsWith('mailto:') ? { publica, privada, contato } : null
}
