'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import { lerFormCampanha, lerFormLink } from '@/lib/campanhas/campanhas'
import { normalizarWhatsapp } from '@/lib/clientes/whatsapp'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar. Tente novamente em instantes.'
const uuid = (v: string) => z.uuid().safeParse(v).success

// R78: only the owner registers campaigns (the database refuses anyone else).
export async function criarCampanha(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = Object.fromEntries(['nome', 'canal', 'utm', 'inicio', 'fim', 'gasto'].map((k) => [k, String(fd.get(k) ?? '')]))
  const r = lerFormCampanha(fd)
  if (!r.ok) return { campos: Object.fromEntries(Object.entries(r.campos).map(([k, v]) => [k, [v]])), valores, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('campanhas').insert({ ...r.dados, agencia_id: agenciaId })
  if (error?.code === '23505') return { campos: { utm: ['Já existe uma campanha com essa etiqueta.'] }, valores, versao }
  if (error?.code === '42501') return { erro: 'Só o dono da agência cadastra campanhas.', valores, versao }
  if (error) { console.error('criarCampanha falhou', error.code); return { erro: ERRO, valores, versao } }
  revalidatePath('/campanhas')
  return { ok: 'Campanha cadastrada.', versao }
}

export async function apagarCampanha(id: string): Promise<EstadoForm> {
  if (!uuid(id)) return { erro: ERRO }
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('campanhas').delete().eq('id', id).select('id')
  if (error) { console.error('apagarCampanha falhou', error.code); return { erro: ERRO } }
  if (!data?.length) return { erro: 'Só o dono da agência apaga campanhas.' }
  revalidatePath('/campanhas')
  return { ok: 'Campanha apagada. Os leads dela continuam no funil.' }
}

// R81: the owner sets the agency number and opening message of the Google ad link (the code is created once).
export async function salvarLinkWhatsapp(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { whatsapp: String(fd.get('whatsapp') ?? ''), mensagem: String(fd.get('mensagem') ?? ''), ativo: fd.get('ativo') === 'on' ? 'on' : '' }
  const r = lerFormLink(fd, normalizarWhatsapp)
  if (!r.ok) return { campos: Object.fromEntries(Object.entries(r.campos).map(([k, v]) => [k, [v]])), valores, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  // Update first, insert when there is no link yet (an upsert would need update rights on agencia_id).
  const atualizado = await supabase.from('links_whatsapp').update({ ...r.dados, atualizado_em: new Date().toISOString() }).eq('agencia_id', agenciaId).select('agencia_id')
  const { error } = atualizado.error || atualizado.data?.length
    ? atualizado
    : await supabase.from('links_whatsapp').insert({ agencia_id: agenciaId, ...r.dados })
  if (error?.code === '42501') return { erro: 'Só o dono da agência muda o link.', valores, versao }
  if (error) { console.error('salvarLinkWhatsapp falhou', error.code); return { erro: ERRO, valores, versao } }
  revalidatePath('/campanhas')
  return { ok: 'Link salvo.', valores, versao }
}
