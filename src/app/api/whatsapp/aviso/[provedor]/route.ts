import { createClient } from '@supabase/supabase-js'
import { lerCorpoAte } from '@/lib/http/corpo'
import { desafioDeVerificacao } from '@/lib/whatsapp/meta'
import { chamadaDoAviso, obterProvedorWhatsapp, tratarAvisoWhatsapp } from '@/lib/whatsapp/whatsapp'

const MAX_BYTES = 512 * 1024 // providers batch several events per notice; history chunks are larger (spec 21, R113)

// Spec 21, R111: Meta checks the webhook once with a GET; answer only for the configured provider and our verify token.
export async function GET(request: Request, { params }: { params: Promise<{ provedor: string }> }) {
  const { provedor: nomeNaUrl } = await params
  const provedor = obterProvedorWhatsapp(process.env)
  if (!provedor || provedor.nome !== nomeNaUrl) return new Response(null, { status: 404 })
  const desafio = desafioDeVerificacao(new URL(request.url).searchParams, process.env.WHATSAPP_META_VERIFY_TOKEN)
  return desafio ? new Response(desafio, { status: 200, headers: { 'content-type': 'text/plain' } }) : new Response(null, { status: 403 })
}

// R73: WhatsApp provider notice (server to server). Without a configured provider this route does not exist (404).
export async function POST(request: Request, { params }: { params: Promise<{ provedor: string }> }) {
  const { provedor: nomeNaUrl } = await params
  const provedor = obterProvedorWhatsapp(process.env)
  if (!provedor) return new Response(null, { status: 404 })
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BYTES) return new Response(null, { status: 413 })
  const corpo = await lerCorpoAte(request, MAX_BYTES)
  if (corpo === null) return new Response(null, { status: 413 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  const r = await tratarAvisoWhatsapp({
    provedor, nomeNaUrl, corpo, cabecalhos: request.headers,
    gravar: async (a) => {
      if (!url || !chave) return { ok: false, codigo: 'sem_chave_servico' }
      const { funcao, args } = chamadaDoAviso(a)
      const { error } = await createClient(url, chave, { auth: { persistSession: false } }).rpc(funcao, args)
      return error ? { ok: false, codigo: error.code ?? 'erro' } : { ok: true }
    },
  })
  if (r.conferir) console.error('aviso do WhatsApp recusado: conferir manualmente', r.conferir)
  if (r.status === 500) console.error('aviso do WhatsApp falhou')
  return new Response(null, { status: r.status })
}
