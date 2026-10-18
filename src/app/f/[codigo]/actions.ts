'use server'

import { headers } from 'next/headers'
import { hashVisitante, lerEnvio, lerOrigemDoLink, PARAMETROS_DO_LINK } from '@/lib/formulario/formulario'
import type { EstadoForm } from '@/lib/forms'
import { criarClientePublico } from '@/lib/supabase/publico'

const OK = 'Recebemos seu contato! A agência vai falar com você pelo WhatsApp.'
const CODIGO = /^[A-Za-z0-9_-]{24}$/
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

// R67/R68: everything is checked again by the database; this layer only gives clear messages.
export async function enviarFormulario(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const codigo = texto(fd, 'codigo')
  const valores = { nome: texto(fd, 'nome'), whatsapp: texto(fd, 'whatsapp'), destino: texto(fd, 'destino'), pessoas: texto(fd, 'pessoas'), data: texto(fd, 'data'), mensagem: texto(fd, 'mensagem') }
  if (!CODIGO.test(codigo)) return { erro: 'Este formulário não está disponível.', versao }
  const r = lerEnvio(fd)
  if (!r.ok) {
    if (r.robo) return { ok: OK, versao } // never tell a robot it was caught
    return { campos: Object.fromEntries(Object.entries(r.campos).map(([k, v]) => [k, [v]])), valores, versao }
  }
  const origem = lerOrigemDoLink(Object.fromEntries(PARAMETROS_DO_LINK.map((k) => [k, texto(fd, k)])))
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'desconhecido'
  const { error } = await criarClientePublico().rpc('enviar_formulario_publico', {
    p_codigo: codigo, p_visitante: hashVisitante(ip, codigo), p_nome: r.dados.nome, p_whatsapp: r.dados.whatsapp,
    p_destino: r.dados.destino, p_pessoas: r.dados.pessoas, p_data: r.dados.data, p_mensagem: r.dados.mensagem,
    p_aceita: r.dados.aceita, p_origem: origem.origem, p_utm_fonte: origem.utmFonte, p_utm_campanha: origem.utmCampanha,
    p_extras: { utm_midia: origem.utmMidia, utm_termo: origem.utmTermo, utm_conteudo: origem.utmConteudo, gclid: origem.gclid, fbclid: origem.fbclid },
  })
  if (error?.code === 'P0002') return { erro: 'Este formulário não está disponível.', versao }
  if (error?.code === 'CR016') return { erro: 'Recebemos muitos envios agora. Tente de novo mais tarde.', valores, versao }
  if (error) { console.error('enviarFormulario falhou', error.code); return { erro: 'Não foi possível enviar. Tente novamente em instantes.', valores, versao } }
  return { ok: OK, versao }
}
