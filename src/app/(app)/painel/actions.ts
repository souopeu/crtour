'use server'

import { revalidatePath } from 'next/cache'
import { getAgenciaId } from '@/lib/auth/agencia'
import type { EstadoForm } from '@/lib/forms'
import { metaSchema } from '@/lib/painel/painel'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar a meta. Tente novamente em instantes.'

// Blank value removes the goal of the month. Only the owner passes the database policies.
export async function salvarMeta(mes: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { valor: String(fd.get('valor') ?? '') }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return { erro: ERRO, valores, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  const dia = `${mes}-01`

  if (valores.valor.trim() === '') {
    const { error } = await supabase.from('metas').delete().eq('mes', dia)
    if (error) console.error('apagar meta falhou', error.code)
    revalidatePath('/painel')
    return error ? { erro: ERRO, valores, versao } : { ok: 'Meta removida.', versao }
  }
  const r = metaSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }

  // update, then insert: an upsert would need update rights on the key columns
  const atualizada = await supabase.from('metas').update({ valor_centavos: r.data.valor }).eq('mes', dia).select('id')
  const { error } = atualizada.data?.length
    ? atualizada
    : await supabase.from('metas').insert({ agencia_id: agenciaId, mes: dia, valor_centavos: r.data.valor })
  if (error) {
    console.error('salvarMeta falhou', error.code)
    return { erro: error.code === '42501' ? 'Só o dono da agência define a meta.' : ERRO, valores, versao }
  }
  revalidatePath('/painel')
  return { ok: 'Meta salva.', versao }
}
