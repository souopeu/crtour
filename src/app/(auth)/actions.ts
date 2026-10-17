'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cadastroSchema, loginSchema, novaSenhaSchema, recuperarSchema } from '@/lib/auth/schemas'
import { traduzirErroAuth } from '@/lib/auth/mensagens'
import { proximoSeguro } from '@/lib/auth/redirect'
import type { EstadoForm } from '@/lib/forms'
import { urlDoSite } from '@/lib/auth/site'
import { criarClienteServidor } from '@/lib/supabase/server'

export type { EstadoForm }

const texto = (fd: FormData, nome: string) => String(fd.get(nome) ?? '')

const ERRO_SITE = 'Configuração do site incompleta. Avise o suporte.'

async function origem() {
  const h = await headers()
  return urlDoSite(process.env, h.get('origin'))
}

export async function entrar(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const dados = { email: texto(fd, 'email'), senha: texto(fd, 'senha') }
  const r = loginSchema.safeParse(dados)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores: { email: dados.email } }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.signInWithPassword({ email: r.data.email, password: r.data.senha })
  if (error) return { erro: traduzirErroAuth(error), valores: { email: dados.email } }
  redirect(proximoSeguro(texto(fd, 'next')))
}

export async function cadastrar(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const dados = {
    nome: texto(fd, 'nome'),
    agenciaNome: texto(fd, 'agenciaNome'),
    email: texto(fd, 'email'),
    senha: texto(fd, 'senha'),
    aceite: fd.get('aceite') ?? undefined,
  }
  const valores = { nome: dados.nome, agenciaNome: dados.agenciaNome, email: dados.email }
  const r = cadastroSchema.safeParse(dados)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores }

  const site = await origem()
  if (!site) return { erro: ERRO_SITE, valores }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.auth.signUp({
    email: r.data.email,
    password: r.data.senha,
    options: {
      emailRedirectTo: `${site}/auth/confirmar`,
      data: { nome: r.data.nome, agencia_nome: r.data.agenciaNome, aceite_termos_em: new Date().toISOString() },
    },
  })
  if (error) return { erro: traduzirErroAuth(error), valores }
  if (!data.session) {
    return { ok: 'Enviamos um link de confirmação para o seu e-mail. Abra-o para entrar.', valores }
  }
  redirect('/')
}

export async function recuperar(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const dados = { email: texto(fd, 'email') }
  const r = recuperarSchema.safeParse(dados)
  if (!r.success) return { campos: r.error.flatten().fieldErrors, valores: dados }

  const site = await origem()
  if (!site) return { erro: ERRO_SITE, valores: dados }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.resetPasswordForEmail(r.data.email, {
    redirectTo: `${site}/auth/confirmar?next=/nova-senha`,
  })
  if (error?.code === 'over_email_send_rate_limit' || error?.code === 'over_request_rate_limit') {
    return { erro: traduzirErroAuth(error), valores: dados }
  }
  // Same answer whether or not the e-mail exists (no account enumeration).
  return { ok: 'Se esse e-mail tiver conta, enviamos um link para criar uma nova senha.', valores: dados }
}

export async function definirNovaSenha(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const r = novaSenhaSchema.safeParse({ senha: texto(fd, 'senha'), confirmacao: texto(fd, 'confirmacao') })
  if (!r.success) return { campos: r.error.flatten().fieldErrors }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.updateUser({ password: r.data.senha })
  if (error) return { erro: traduzirErroAuth(error) }
  redirect('/')
}

export async function sair() {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
  redirect('/login')
}
