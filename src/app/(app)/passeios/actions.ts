'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import type { EstadoForm } from '@/lib/forms'
import { passeioSchema, saidaSchema } from '@/lib/passeios/schema'
import { mensagemDeErroReserva } from '@/lib/reservas/schema'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar. Tente novamente em instantes.'
const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

export async function salvarPasseio(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { nome: texto(fd, 'nome'), destino: texto(fd, 'destino'), descricao: texto(fd, 'descricao'), inclui: texto(fd, 'inclui'), nao_inclui: texto(fd, 'nao_inclui') }
  const r = passeioSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }

  const supabase = await criarClienteServidor()
  if (id === null) {
    const agenciaId = await getAgenciaId()
    if (!agenciaId) return { erro: ERRO, valores, versao }
    const { data, error } = await supabase.from('passeios').insert({ ...r.data, agencia_id: agenciaId }).select('id').single()
    if (error || !data) {
      console.error('salvarPasseio insert falhou', error?.code)
      return { erro: ERRO, valores, versao }
    }
    revalidatePath('/passeios')
    redirect(`/passeios/${data.id}`)
  }
  const { data, error } = await supabase.from('passeios').update(r.data).eq('id', id).select('id')
  if (error || !data?.length) {
    console.error('salvarPasseio update falhou', error?.code)
    return { erro: ERRO, valores, versao }
  }
  revalidatePath('/passeios')
  revalidatePath(`/passeios/${id}`)
  return { ok: 'Alterações salvas.', valores, versao }
}

export async function alternarArquivado(id: string, arquivar: boolean): Promise<void> {
  if (!uuid(id)) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('passeios').update({ arquivado: arquivar }).eq('id', id)
  if (error) console.error('alternarArquivado falhou', error.code)
  revalidatePath('/passeios')
  revalidatePath(`/passeios/${id}`)
}

// Only empty tours can be deleted (the database refuses otherwise); the rest are archived.
export async function excluirPasseio(id: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(id)) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('passeios').delete().eq('id', id)
  if (error) {
    return {
      erro: error.code === '23503' ? 'Este passeio já tem saídas. Arquive em vez de excluir.' : ERRO,
      versao,
    }
  }
  revalidatePath('/passeios')
  redirect('/passeios')
}

export async function salvarSaida(passeioId: string, saidaId: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = {
    data: texto(fd, 'data'), capacidade: texto(fd, 'capacidade'), preco: texto(fd, 'preco'),
    situacao: texto(fd, 'situacao') || 'aberta', horario: texto(fd, 'horario'), veiculo: texto(fd, 'veiculo'),
  }
  const r = saidaSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(passeioId)) return { erro: ERRO, valores, versao }

  const supabase = await criarClienteServidor()
  if (saidaId === null) {
    const agenciaId = await getAgenciaId()
    if (!agenciaId) return { erro: ERRO, valores, versao }
    const { error } = await supabase.from('saidas').insert({ ...r.data, agencia_id: agenciaId, passeio_id: passeioId })
    if (error) {
      if (error.code !== 'CR019') console.error('salvarSaida insert falhou', error.code)
      return { erro: error.code === 'CR019' ? mensagemDeErroReserva('CR019') : ERRO, valores, versao }
    }
    revalidatePath(`/passeios/${passeioId}`)
    revalidatePath('/passeios')
    return { ok: 'Saída criada.', versao } // empty values: the form restarts clean for the next one
  }
  const { data, error } = await supabase.from('saidas').update(r.data).eq('id', saidaId).select('id')
  if (error || !data?.length) {
    const esperado = error?.code === 'CR003' || error?.code === 'CR019'
    if (!esperado) console.error('salvarSaida update falhou', error?.code)
    return { erro: esperado ? mensagemDeErroReserva(error?.code) : ERRO, valores, versao }
  }
  revalidatePath(`/saidas/${saidaId}`)
  revalidatePath(`/passeios/${passeioId}`)
  return { ok: 'Alterações salvas.', valores, versao }
}

export async function excluirSaida(passeioId: string, saidaId: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(passeioId) || !uuid(saidaId)) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('saidas').delete().eq('id', saidaId)
  if (error) {
    return { erro: error.code === '23503' ? 'Esta saída já tem reservas. Cancele a saída em vez de excluir.' : ERRO, versao }
  }
  revalidatePath(`/passeios/${passeioId}`)
  redirect(`/passeios/${passeioId}`)
}
