// E4-6 (R58): online payment provider seam. With no provider configured the feature does not exist:
// no screen changes and the notice route answers 404. Plugging a gateway = adding it to PROVEDORES.
export type AvisoPagamento = { idExterno: string; valorCentavos: number; forma: 'pix' | 'cartao' | 'outro'; pagoEm: string }

export interface ProvedorPagamento {
  nome: string
  criarCobranca(d: { reservaId: string; valorCentavos: number; descricao: string; venceEm: string | null }): Promise<{ idExterno: string; link: string }>
  // Returns null when the notice is not authentic (bad signature) — never trust an unsigned notice.
  validarAviso(corpo: string, cabecalhos: Headers): Promise<AvisoPagamento | null>
}

type Fabrica = (env: Record<string, string | undefined>) => ProvedorPagamento
export const PROVEDORES: Record<string, Fabrica> = {} // no gateway yet (Asaas, Mercado Pago… go here)

export function obterProvedor(env: Record<string, string | undefined>, registro: Record<string, Fabrica> = PROVEDORES): ProvedorPagamento | null {
  const nome = env.PAGAMENTO_ONLINE_PROVEDOR?.trim()
  if (!nome) return null
  const fabrica = registro[nome]
  return fabrica ? fabrica(env) : null
}

// Codes the database uses to refuse a confirmation for a business reason: answer 200 so the provider stops retrying,
// and flag for a person to check. Anything else is unexpected: 500, so the provider tries again later.
const RECUSAS = new Set(['CR006', 'CR007', 'CR015', 'P0002'])

type Confirmar = (d: AvisoPagamento & { provedor: string }) => Promise<{ ok: true } | { ok: false; codigo: string }>

export async function tratarAviso(p: { provedor: ProvedorPagamento | null; nomeNaUrl: string; corpo: string; cabecalhos: Headers; confirmar: Confirmar }):
  Promise<{ status: number; conferir?: string }> {
  if (!p.provedor || p.provedor.nome !== p.nomeNaUrl) return { status: 404 }
  let aviso: AvisoPagamento | null
  try {
    aviso = await p.provedor.validarAviso(p.corpo, p.cabecalhos)
  } catch {
    return { status: 400 }
  }
  if (!aviso) return { status: 401 }
  const r = await p.confirmar({ ...aviso, provedor: p.provedor.nome })
  if (r.ok) return { status: 200 }
  return RECUSAS.has(r.codigo) ? { status: 200, conferir: r.codigo } : { status: 500 }
}

// Reads the request body, giving up (null) as soon as it passes `limite` bytes, even without a content-length header.
export async function lerCorpoAte(request: Request, limite: number): Promise<string | null> {
  if (!request.body) return ''
  const leitor = request.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    total += value.byteLength
    if (total > limite) {
      await leitor.cancel()
      return null
    }
    partes.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(partes))
}
