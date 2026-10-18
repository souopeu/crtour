import { linkWhatsapp } from '@/lib/clientes/whatsappLink'
import { hashVisitante } from '@/lib/formulario/formulario'
import { lerCliqueDoLink, mensagemComCodigo } from '@/lib/origens/origens'
import { criarClientePublico } from '@/lib/supabase/publico'

const CODIGO = /^[A-Za-z0-9_-]{24}$/
const linhaSchema = (v: unknown) => {
  const r = (v as { codigo?: unknown; whatsapp?: unknown; mensagem?: unknown }[] | null)?.[0]
  return r && typeof r.codigo === 'string' && typeof r.whatsapp === 'string' && typeof r.mensagem === 'string'
    ? { codigo: r.codigo, whatsapp: r.whatsapp, mensagem: r.mensagem } : null
}
const texto = (corpo: string, status: number) => new Response(corpo, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })

// R81: the Google ad points here. Stores the click (gclid, tags) and opens the agency's WhatsApp with a short code
// in the message; when the message reaches the CRM, the code links the client to this click.
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  if (!CODIGO.test(codigo)) return texto('Link indisponível.', 404)
  const c = lerCliqueDoLink(new URL(request.url).searchParams)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'desconhecido'
  const { data, error } = await criarClientePublico().rpc('registrar_clique_anuncio', {
    p_link: codigo, p_visitante: hashVisitante(ip, codigo), p_gclid: c.gclid, p_utm_fonte: c.utmFonte, p_utm_midia: c.utmMidia,
    p_utm_campanha: c.utmCampanha, p_utm_termo: c.utmTermo, p_utm_conteudo: c.utmConteudo,
  })
  if (error?.code === 'P0002') return texto('Link indisponível.', 404)
  if (error?.code === 'CR016') return texto('Muitos acessos agora. Tente de novo em alguns minutos.', 429)
  const linha = linhaSchema(data)
  const destino = linha ? linkWhatsapp(linha.whatsapp, mensagemComCodigo(linha.mensagem, linha.codigo)) : null
  if (error || !destino) {
    if (error) console.error('registrarCliqueAnuncio falhou', error.code)
    return texto('Não foi possível abrir o WhatsApp. Tente novamente.', 500)
  }
  return new Response(null, { status: 302, headers: { location: destino, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } })
}
