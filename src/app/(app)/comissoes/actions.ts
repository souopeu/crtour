'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import { lerPercentual, lerRegra, lerValorPorPessoa } from '@/lib/comissao/comissao'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar. Tente novamente em instantes.'
const SO_DONO = 'Só o dono da agência configura a comissão.'
const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

function atualizar() {
  revalidatePath('/configuracoes')
  revalidatePath('/comissoes')
}

// Every update below passes the owner-only database rules; 0 rows changed = not the owner.
export async function salvarRegra(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const r = lerRegra(texto(fd, 'regra'))
  if (!r.ok) return { campos: { regra: [r.erro] }, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('agencias').update({ regra_comissao: r.regra }).eq('id', agenciaId).select('id')
  if (error) { console.error('salvarRegra falhou', error.code); return { erro: ERRO, versao } }
  if (!data?.length) return { erro: SO_DONO, versao }
  atualizar()
  return { ok: 'Regra salva.', versao }
}

export async function salvarPercentualMembro(userId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { valor: texto(fd, 'valor') }
  const r = lerPercentual(valores.valor)
  if (!r.ok) return { campos: { valor: [r.erro] }, valores, versao }
  if (!uuid(userId)) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('membros').update({ comissao_percentual: r.valor }).eq('user_id', userId).select('user_id')
  if (error) { console.error('salvarPercentualMembro falhou', error.code); return { erro: ERRO, valores, versao } }
  if (!data?.length) return { erro: SO_DONO, valores, versao }
  atualizar()
  return { ok: 'Salvo.', valores, versao }
}

export async function salvarComissaoPasseio(passeioId: string, campo: 'percentual' | 'por_pessoa', _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { valor: texto(fd, 'valor') }
  const r = campo === 'percentual' ? lerPercentual(valores.valor) : lerValorPorPessoa(valores.valor)
  if (!r.ok) return { campos: { valor: [r.erro] }, valores, versao }
  if (!uuid(passeioId)) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  const coluna = campo === 'percentual' ? { comissao_percentual: r.valor } : { comissao_por_pessoa_centavos: r.valor }
  const { error } = await supabase.from('passeios').update(coluna).eq('id', passeioId)
  if (error) {
    if (error.code !== '42501') console.error('salvarComissaoPasseio falhou', error.code)
    return { erro: error.code === '42501' ? SO_DONO : ERRO, valores, versao }
  }
  atualizar()
  return { ok: 'Salvo.', valores, versao }
}

export async function definirVendedor(reservaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const vendedor = texto(fd, 'vendedor')
  if (!uuid(reservaId) || (vendedor !== '' && !uuid(vendedor))) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('definir_vendedor_reserva', { p_reserva: reservaId, p_vendedor: vendedor || null })
  if (error) {
    if (error.code !== '42501') console.error('definirVendedor falhou', error.code)
    return { erro: error.code === '42501' ? 'Só o dono muda quem vendeu.' : ERRO, versao }
  }
  revalidatePath(`/reservas/${reservaId}`)
  revalidatePath('/comissoes')
  return { ok: 'Vendedor(a) salvo.', versao }
}
