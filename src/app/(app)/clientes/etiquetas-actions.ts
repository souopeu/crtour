'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import { encontrarEtiqueta, nomeDeEtiqueta } from '@/lib/clientes/etiquetas'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar a etiqueta. Tente novamente em instantes.'

export async function adicionarEtiqueta(clienteId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const nome = nomeDeEtiqueta(String(fd.get('etiqueta') ?? ''))
  if (!nome.ok) return { campos: { etiqueta: [nome.erro] }, versao }
  if (!z.uuid().safeParse(clienteId).success) return { erro: ERRO, versao }

  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()

  const carregar = async () => {
    const { data } = await supabase.from('etiquetas').select('id, nome')
    return encontrarEtiqueta(data ?? [], nome.nome)
  }

  let etiqueta = await carregar()
  if (!etiqueta) {
    const { data, error } = await supabase
      .from('etiquetas')
      .insert({ agencia_id: agenciaId, nome: nome.nome })
      .select('id, nome')
      .single()
    if (error?.code === '23505') etiqueta = await carregar() // created meanwhile by someone else
    else if (error) {
      console.error('adicionarEtiqueta criar falhou', error.code)
      return { erro: ERRO, versao }
    } else etiqueta = data
  }
  if (!etiqueta) return { erro: ERRO, versao }

  const { error } = await supabase
    .from('cliente_etiquetas')
    .upsert(
      { cliente_id: clienteId, etiqueta_id: etiqueta.id, agencia_id: agenciaId },
      { onConflict: 'cliente_id,etiqueta_id', ignoreDuplicates: true },
    )
  if (error) {
    console.error('adicionarEtiqueta vincular falhou', error.code)
    return { erro: ERRO, versao }
  }
  revalidatePath(`/clientes/${clienteId}`)
  return { versao }
}

export async function removerEtiqueta(clienteId: string, etiquetaId: string): Promise<void> {
  if (!z.uuid().safeParse(clienteId).success || !z.uuid().safeParse(etiquetaId).success) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('cliente_etiquetas').delete().eq('cliente_id', clienteId).eq('etiqueta_id', etiquetaId)
  if (error) console.error('removerEtiqueta falhou', error.code)
  revalidatePath(`/clientes/${clienteId}`)
}
