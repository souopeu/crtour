'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAgenciaId } from '@/lib/auth/agencia'
import { urlDoSite } from '@/lib/auth/site'
import { conviteSchema, gerarToken, hashToken, linkDoConvite } from '@/lib/equipe/equipe'
import { getUsuario } from '@/lib/auth/usuario'
import type { EstadoForm } from '@/lib/forms'
import { limitesSchema } from '@/lib/hoje/hoje'
import { criarClienteServidor } from '@/lib/supabase/server'
import { z } from 'zod'

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

const ERRO_EQUIPE = 'Não foi possível concluir. Tente novamente em instantes.'

// Owner invites a seller: a one-time link (shown once; only its hash is stored).
export async function convidar(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { nome: String(fd.get('nome') ?? ''), email: String(fd.get('email') ?? '') }
  const r = conviteSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  const agenciaId = await getAgenciaId()
  const h = await headers()
  const site = urlDoSite(process.env, h.get('origin'))
  if (!agenciaId || !site) return { erro: ERRO_EQUIPE, valores, versao }

  const token = gerarToken()
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('convites').insert({ ...r.data, agencia_id: agenciaId, token_hash: hashToken(token) })
  if (error) {
    if (error.code === '23505') return { erro: 'Já existe um convite pendente para esse e-mail. Cancele o anterior para gerar outro link.', valores, versao }
    if (error.code === '42501') return { erro: 'Só o dono da agência convida pessoas.', valores, versao }
    console.error('convidar falhou', error.code)
    return { erro: ERRO_EQUIPE, valores, versao }
  }
  revalidatePath('/configuracoes')
  return { ok: `Convite criado para ${r.data.email}.`, valores: { link: linkDoConvite(site, token, r.data.email) }, versao }
}

export async function cancelarConvite(conviteId: string): Promise<void> {
  if (!z.uuid().safeParse(conviteId).success) return
  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('convites').delete().eq('id', conviteId)
  if (error) console.error('cancelarConvite falhou', error.code)
  revalidatePath('/configuracoes')
}

export async function removerMembro(userId: string): Promise<EstadoForm> {
  if (!z.uuid().safeParse(userId).success) return { erro: ERRO_EQUIPE }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('remover_membro', { p_user: userId })
  if (error) {
    if (error.code !== '42501') console.error('removerMembro falhou', error.code)
    return { erro: error.code === '42501' ? 'Só o dono remove vendedores.' : ERRO_EQUIPE }
  }
  revalidatePath('/configuracoes')
  return { ok: 'Acesso removido.' }
}

const formularioSchema = z.object({
  titulo: z.string().trim().min(1, 'Digite um título.').max(120, 'O título pode ter no máximo 120 caracteres.'),
  texto: z.string().trim().max(1000, 'O texto pode ter no máximo 1000 caracteres.'),
})

// R65: the owner turns the public form on or off and edits its texts.
export async function salvarFormulario(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const versao = crypto.randomUUID()
  const valores = { titulo: String(fd.get('titulo') ?? ''), texto: String(fd.get('texto') ?? ''), ativo: fd.get('ativo') === 'on' ? 'on' : '' }
  const r = formularioSchema.safeParse(valores)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores, versao }
  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('salvar_formulario', { p_ativo: valores.ativo === 'on', p_titulo: r.data.titulo, p_texto: r.data.texto })
  if (error) {
    console.error('salvarFormulario falhou', error.code)
    return { erro: error.code === '42501' ? 'Só o dono muda o formulário.' : 'Não foi possível salvar. Tente novamente em instantes.', valores, versao }
  }
  revalidatePath('/configuracoes')
  return { ok: 'Formulário salvo.', valores, versao }
}
