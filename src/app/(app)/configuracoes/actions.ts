'use server'

import { redirect } from 'next/navigation'
import { getUsuario } from '@/lib/auth/usuario'
import type { EstadoForm } from '@/lib/forms'
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
