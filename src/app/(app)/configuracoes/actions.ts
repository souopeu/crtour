'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAgenciaId } from '@/lib/auth/agencia'
import { getUsuario } from '@/lib/auth/usuario'
import type { EstadoForm } from '@/lib/forms'
import { limitesSchema } from '@/lib/hoje/hoje'
import { criarClienteServidor } from '@/lib/supabase/server'

const PALAVRA = 'EXCLUIR'

export async function excluirConta(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const confirmacao = String(fd.get('confirmacao') ?? '').trim()
  const senha = String(fd.get('senha') ?? '')
  if (confirmacao !== PALAVRA) return { campos: { confirmacao: [`Digite ${PALAVRA} para confirmar.`] }, versao }
  if (!senha) return { campos: { senha: ['Digite sua senha.'] }, versao }

  const usuario = await getUsuario()
  if (!usuario?.email) redirect('/login')

  const supabase = await criarClienteServidor()
  // Re-check the password: a stolen session alone must not be able to wipe the account.
  const { error: erroSenha } = await supabase.auth.signInWithPassword({ email: usuario.email, password: senha })
  if (erroSenha) return { campos: { senha: ['Senha incorreta.'] }, versao }

  const { error } = await supabase.rpc('excluir_minha_conta')
  if (error) {
    console.error('excluir_minha_conta falhou', error.code)
    return {
      erro: error.code === '42501' ? 'Só o dono da agência pode excluir a conta.' : 'Não foi possível excluir a conta. Tente novamente em instantes.',
      versao,
    }
  }
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login?conta=excluida')
}

export async function salvarLimites(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { diasSemContato: String(fd.get('diasSemContato') ?? ''), diasParada: String(fd.get('diasParada') ?? '') }
  const r = limitesSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  const agenciaId = await getAgenciaId()
  if (!agenciaId) return { erro: 'Não foi possível salvar. Tente novamente em instantes.', valores, versao }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.from('agencias').update({ dias_sem_contato: r.data.diasSemContato, dias_negociacao_parada: r.data.diasParada }).eq('id', agenciaId).select('id')
  if (error) {
    console.error('salvarLimites falhou', error.code)
    return { erro: 'Não foi possível salvar. Tente novamente em instantes.', valores, versao }
  }
  if (!data?.length) return { erro: 'Só o dono da agência pode mudar estes prazos.', valores, versao }
  revalidatePath('/hoje')
  revalidatePath('/funil')
  revalidatePath('/configuracoes')
  return { ok: 'Prazos salvos.', valores, versao }
}
