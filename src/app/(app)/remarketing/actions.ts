'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import type { EstadoForm } from '@/lib/forms'
import { lerCriterios, segmentoSchema } from '@/lib/segmentos/segmentos'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar. Tente novamente em instantes.'
const NOME_REPETIDO = 'Já existe um segmento com esse nome.'
const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

export async function criarSegmento(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { nome: texto(fd, 'nome'), mensagem: texto(fd, 'mensagem') }
  const r = segmentoSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  const criterios = lerCriterios(Object.fromEntries(new URLSearchParams(texto(fd, 'criterios'))))
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, valores, versao }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('segmentos').insert({ ...r.data, criterios, agencia_id: agenciaId }).select('id').single()
  if (error) {
    if (error.code !== '23505') console.error('criarSegmento falhou', error.code)
    return { erro: error.code === '23505' ? NOME_REPETIDO : ERRO, valores, versao }
  }
  revalidatePath('/remarketing')
  redirect(`/remarketing/${data.id}`)
}

export async function salvarMensagem(segmentoId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { nome: texto(fd, 'nome'), mensagem: texto(fd, 'mensagem') }
  const r = segmentoSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(segmentoId)) return { erro: ERRO, valores, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('segmentos').update(r.data).eq('id', segmentoId)
  if (error) {
    if (error.code !== '23505') console.error('salvarMensagem falhou', error.code)
    return { erro: error.code === '23505' ? NOME_REPETIDO : ERRO, valores, versao }
  }
  revalidatePath(`/remarketing/${segmentoId}`)
  revalidatePath('/remarketing')
  return { ok: 'Mensagem salva.', valores: r.data, versao }
}

export async function novaRodada(segmentoId: string, rodadaAtual: number): Promise<void> {
  if (!uuid(segmentoId) || !Number.isInteger(rodadaAtual)) return
  const supabase = await criarClienteServidor()
  // Only moves on from the round the person was looking at (a double tap does not skip two rounds).
  const { error } = await supabase.from('segmentos').update({ rodada: rodadaAtual + 1 }).eq('id', segmentoId).eq('rodada', rodadaAtual)
  if (error) console.error('novaRodada falhou', error.code)
  revalidatePath(`/remarketing/${segmentoId}`)
}

export async function apagarSegmento(segmentoId: string): Promise<EstadoForm> {
  if (!uuid(segmentoId)) return { erro: ERRO }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('segmentos').delete().eq('id', segmentoId)
  if (error) {
    console.error('apagarSegmento falhou', error.code)
    return { erro: 'Não foi possível apagar. Tente novamente em instantes.' }
  }
  revalidatePath('/remarketing')
  redirect('/remarketing')
}

// One WhatsApp send of the campaign: done activity + mark in the round (atomic, in the database).
export async function registrarEnvio(segmentoId: string, clienteId: string, mensagem: string): Promise<EstadoForm> {
  if (!uuid(segmentoId) || !uuid(clienteId)) return { erro: ERRO }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('registrar_envio_segmento', { p_segmento: segmentoId, p_cliente: clienteId, p_mensagem: mensagem.slice(0, 1000) })
  if (error) {
    if (error.code === 'CR009') return { erro: 'Este cliente não aceitou receber mensagens.' }
    if (error.code === 'CR010') return { erro: 'Este cliente já foi chamado nesta rodada.' }
    console.error('registrarEnvio falhou', error.code)
    return { erro: ERRO }
  }
  revalidatePath(`/remarketing/${segmentoId}`)
  revalidatePath(`/clientes/${clienteId}`)
  revalidatePath('/hoje')
  return { ok: 'Envio registrado.' }
}
