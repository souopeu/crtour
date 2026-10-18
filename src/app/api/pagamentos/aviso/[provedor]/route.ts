import { createClient } from '@supabase/supabase-js'
import { lerCorpoAte, obterProvedor, tratarAviso } from '@/lib/pagamento-online/pagamentoOnline'

const MAX_BYTES = 64 * 1024 // provider notices are small

// R58: payment provider notice (server to server). Without a configured provider this route does not exist (404).
// Authenticity comes from the provider's signature; confirmation uses the service key, which never reaches the browser.
export async function POST(request: Request, { params }: { params: Promise<{ provedor: string }> }) {
  const { provedor: nomeNaUrl } = await params
  const provedor = obterProvedor(process.env)
  if (!provedor) return new Response(null, { status: 404 })
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BYTES) return new Response(null, { status: 413 })
  const corpo = await lerCorpoAte(request, MAX_BYTES) // the header can be missing (chunked body)
  if (corpo === null) return new Response(null, { status: 413 })

  const r = await tratarAviso({
    provedor, nomeNaUrl, corpo, cabecalhos: request.headers,
    confirmar: async (d) => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!url || !chave) return { ok: false, codigo: 'sem_chave_servico' }
      const admin = createClient(url, chave, { auth: { persistSession: false } })
      const { error } = await admin.rpc('confirmar_cobranca_online', {
        p_provedor: d.provedor, p_id_externo: d.idExterno, p_valor: d.valorCentavos, p_forma: d.forma, p_pago_em: d.pagoEm,
      })
      return error ? { ok: false, codigo: error.code ?? 'erro' } : { ok: true }
    },
  })
  if (r.conferir) console.error('aviso de pagamento online recusado: conferir manualmente', r.conferir)
  if (r.status === 500) console.error('aviso de pagamento online falhou')
  return new Response(null, { status: r.status })
}
