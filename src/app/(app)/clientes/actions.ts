'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAgenciaId, getMembro } from '@/lib/auth/agencia'
import { clienteSchema } from '@/lib/clientes/schema'
import { valoresDoForm } from '@/lib/clientes/formulario'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO_SALVAR = 'Não foi possível salvar o cliente. Tente novamente em instantes.'

// `id` is bound by the page: null creates, a uuid updates.
export async function salvarCliente(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const valores = valoresDoForm(fd)
  const versao = crypto.randomUUID()
  const r = clienteSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }

  const supabase = await criarClienteServidor()

  if (id === null) {
    const agenciaId = await getAgenciaId()
    if (!agenciaId) return { erro: ERRO_SALVAR, valores, versao }
    const { data, error } = await supabase
      .from('clientes')
      .insert({ ...r.data, agencia_id: agenciaId })
      .select('id')
      .single()
    if (error || !data) {
      console.error('salvarCliente insert falhou', error?.code)
      return { erro: ERRO_SALVAR, valores, versao }
    }
    revalidatePath('/')
    // R123: a client created from "Nova negociação" goes straight back to it (fixed value, never a URL from the form)
    redirect(fd.get('depois') === 'negociacao' ? `/negociacoes/novo?cliente=${data.id}` : `/clientes/${data.id}`)
  }

  const { data, error } = await supabase.from('clientes').update(r.data).eq('id', id).select('id')
  if (error || !data?.length) {
    console.error('salvarCliente update falhou', error?.code)
    return { erro: ERRO_SALVAR, valores, versao }
  }
  revalidatePath('/')
  revalidatePath(`/clientes/${id}`)
  return { ok: 'Alterações salvas.', valores, versao }
}

// R162: a partner agency (B2B). Only the owner marks it; a seller's click changes nothing.
export async function alternarParceiro(id: string, parceiro: boolean): Promise<void> {
  const membro = await getMembro()
  if (!z.uuid().safeParse(id).success || membro?.papel !== 'dono') return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('clientes').update({ parceiro }).eq('id', id)
  if (error) console.error('alternarParceiro falhou', error.code)
  revalidatePath(`/clientes/${id}`)
}
