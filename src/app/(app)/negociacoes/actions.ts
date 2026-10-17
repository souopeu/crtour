'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import type { EstadoForm } from '@/lib/forms'
import { negociacaoSchema } from '@/lib/negociacoes/negociacoes'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar a negociação. Tente novamente em instantes.'
const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

function lerForm(fd: FormData) {
  const valores = {
    titulo: texto(fd, 'titulo'), valor: texto(fd, 'valor'), etapa: texto(fd, 'etapa'), probabilidade: texto(fd, 'probabilidade'),
    responsavel: texto(fd, 'responsavel'), dataEsperada: texto(fd, 'dataEsperada'), saida: texto(fd, 'saida'),
  }
  return { valores, r: negociacaoSchema.safeParse(valores) }
}

export async function criarNegociacao(clienteId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const { valores, r } = lerForm(fd)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(clienteId)) return { erro: ERRO, valores, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, valores, versao }

  const { probabilidade, ...resto } = r.data
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('negociacoes')
    // a blank probability is omitted: the database applies the stage default
    .insert({ ...resto, ...(probabilidade === null ? {} : { probabilidade }), agencia_id: agenciaId, cliente_id: clienteId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('criarNegociacao falhou', error?.code)
    return { erro: ERRO, valores, versao }
  }
  revalidatePath('/funil')
  revalidatePath(`/clientes/${clienteId}`)
  redirect(`/negociacoes/${data.id}`)
}

export async function atualizarNegociacao(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const { valores, r } = lerForm(fd)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(id)) return { erro: ERRO, valores, versao }

  const { probabilidade, ...resto } = r.data
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('negociacoes')
    .update({ ...resto, ...(probabilidade === null ? {} : { probabilidade }) })
    .eq('id', id)
    .select('id')
  if (error || !data?.length) {
    console.error('atualizarNegociacao falhou', error?.code)
    return { erro: ERRO, valores, versao }
  }
  revalidatePath('/funil')
  revalidatePath(`/negociacoes/${id}`)
  return { ok: 'Alterações salvas.', versao } // remount with the saved (possibly recalculated) values
}
