'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAgenciaId } from '@/lib/auth/agencia'
import { atividadeSchema } from '@/lib/atividades/atividades'
import type { EstadoForm } from '@/lib/forms'
import { criarClienteServidor } from '@/lib/supabase/server'

const ERRO = 'Não foi possível salvar a atividade. Tente novamente em instantes.'
const uuid = (v: string) => z.uuid().safeParse(v).success
const texto = (fd: FormData, n: string) => String(fd.get(n) ?? '')

function atualizarTelas(clienteId: string) {
  revalidatePath(`/clientes/${clienteId}`)
  revalidatePath('/')
}

export async function criarAtividade(clienteId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = {
    tipo: texto(fd, 'tipo'), titulo: texto(fd, 'titulo'), quando: texto(fd, 'quando'), status: texto(fd, 'status'),
    responsavel: texto(fd, 'responsavel'), negociacao: texto(fd, 'negociacao'),
  }
  const r = atividadeSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  if (!uuid(clienteId)) return { erro: ERRO, valores, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, valores, versao }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('atividades').insert({ ...r.data, agencia_id: agenciaId, cliente_id: clienteId })
  if (error) {
    console.error('criarAtividade falhou', error.code)
    return { erro: ERRO, valores, versao }
  }
  atualizarTelas(clienteId)
  return { ok: r.data.status === 'feito' ? 'Atividade registrada.' : 'Atividade agendada.', versao } // clean form for the next one
}

export async function alternarAtividade(clienteId: string, atividadeId: string, status: 'pendente' | 'feito'): Promise<void> {
  if (!uuid(clienteId) || !uuid(atividadeId) || !['pendente', 'feito'].includes(status)) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('atividades').update({ status }).eq('id', atividadeId)
  if (error) console.error('alternarAtividade falhou', error.code)
  atualizarTelas(clienteId)
}

export async function apagarAtividade(clienteId: string, atividadeId: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(clienteId) || !uuid(atividadeId)) return { erro: ERRO, versao }
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('atividades').delete().eq('id', atividadeId).select('id')
  if (error) {
    console.error('apagarAtividade falhou', error.code)
    return { erro: ERRO, versao }
  }
  if (!data?.length) return { erro: 'Só quem criou a atividade, ou o dono, pode apagá-la.', versao }
  atualizarTelas(clienteId)
  return { ok: 'Atividade apagada.', versao }
}

// "Registrar como feito" after opening WhatsApp: one tap, logged as a done WhatsApp activity.
export async function registrarWhatsapp(clienteId: string, mensagem: string): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  if (!uuid(clienteId)) return { erro: ERRO, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: ERRO, versao }

  const resumo = mensagem.trim().replace(/\s+/g, ' ')
  const titulo = `WhatsApp: ${resumo.length > 120 ? `${resumo.slice(0, 117)}…` : resumo}`.slice(0, 200)
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('atividades').insert({
    agencia_id: agenciaId, cliente_id: clienteId, tipo: 'whatsapp', titulo: resumo ? titulo : 'WhatsApp', quando: new Date().toISOString(), status: 'feito',
  })
  if (error) {
    console.error('registrarWhatsapp falhou', error.code)
    return { erro: ERRO, versao }
  }
  atualizarTelas(clienteId)
  return { ok: 'Registrado na linha do tempo.', versao }
}
