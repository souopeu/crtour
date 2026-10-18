import { createClient } from '@supabase/supabase-js'
import { lerCorpoAte } from '@/lib/http/corpo'
import { obterProvedorWhatsapp, referenciaParaBanco, tratarAvisoWhatsapp } from '@/lib/whatsapp/whatsapp'

const MAX_BYTES = 256 * 1024 // providers batch several events per notice

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
      const admin = createClient(url, chave, { auth: { persistSession: false } })
      const { error } = a.tipo === 'mensagem'
        ? await admin.rpc('whatsapp_receber', { p_provedor: a.provedor, p_conta: a.conta, p_id_externo: a.idExterno, p_de: a.de, p_nome: a.nome, p_texto: a.texto, p_recebida_em: a.em, p_referencia: referenciaParaBanco(a.referencia) })
        : await admin.rpc('whatsapp_status', { p_provedor: a.provedor, p_id_externo: a.idExterno, p_situacao: a.situacao })
      return error ? { ok: false, codigo: error.code ?? 'erro' } : { ok: true }
    },
  })
  if (r.conferir) console.error('aviso do WhatsApp recusado: conferir manualmente', r.conferir)
  if (r.status === 500) console.error('aviso do WhatsApp falhou')
  return new Response(null, { status: r.status })
}
