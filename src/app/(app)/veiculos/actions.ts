'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'
import { veiculoSchema } from '@/lib/veiculos/veiculos'

const ERRO = 'Não foi possível salvar. Tente novamente em instantes.'
const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

// R137: create (id null) or edit a vehicle.
export async function salvarVeiculo(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { nome: texto(fd, 'nome'), categoria: texto(fd, 'categoria'), lugares: texto(fd, 'lugares') }
  const r = veiculoSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  const supabase = await criarClienteServidor()
  if (id === null) {
    const agenciaId = await getAgenciaId()
    if (!agenciaId) return { erro: ERRO, valores, versao }
    const { error } = await supabase.from('veiculos').insert({ ...r.data, agencia_id: agenciaId })
    if (error) { console.error('criarVeiculo falhou', error.code); return { erro: ERRO, valores, versao } }
    revalidatePath('/veiculos')
    return { ok: 'Veículo cadastrado.', versao } // clean form for the next one
  }
  if (!uuid(id)) return { erro: ERRO, valores, versao }
  const { data, error } = await supabase.from('veiculos').update(r.data).eq('id', id).select('id')
  if (error || !data?.length) {
    if (error?.code !== 'CR019') console.error('editarVeiculo falhou', error?.code)
    return { erro: error?.code === 'CR019' ? 'Há saídas com mais vagas do que estes lugares. Diminua as vagas dessas saídas primeiro.' : ERRO, valores, versao }
  }
  revalidatePath('/veiculos')
  revalidatePath(`/veiculos/${id}`)
  return { ok: 'Alterações salvas.', valores, versao }
}

export async function alternarArquivadoVeiculo(id: string, arquivar: boolean): Promise<void> {
  if (!uuid(id)) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('veiculos').update({ arquivado: arquivar }).eq('id', id)
  if (error) console.error('arquivarVeiculo falhou', error.code)
  revalidatePath('/veiculos')
  revalidatePath(`/veiculos/${id}`)
}

// Only the owner deletes, and only a vehicle no departure uses (the database refuses otherwise).
export async function apagarVeiculo(id: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(id)) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('veiculos').delete().eq('id', id).select('id')
  if (error) {
    if (error.code !== '23503') console.error('apagarVeiculo falhou', error.code)
    return { erro: error.code === '23503' ? 'Este veículo já foi usado em saídas. Arquive em vez de apagar.' : ERRO, versao }
  }
  if (!data?.length) return { erro: 'Só o dono da agência apaga veículos.', versao }
  revalidatePath('/veiculos')
  redirect('/veiculos')
}
