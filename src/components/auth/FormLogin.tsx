'use client'

import Link from 'next/link'
import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { entrar, type EstadoForm } from '@/app/(auth)/actions'
import { IconeAuth } from './IconesAuth'
import { Mensagem } from './Mensagem'

const caixa = 'flex h-13 items-center gap-3 rounded-xl border border-controle bg-superficie px-3 focus-within:border-marca focus-within:ring-2 focus-within:ring-marca/30'
const entrada = 'h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-tinta-suave'

function BotaoEntrar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-marca px-6 font-semibold text-white shadow-lg shadow-marca/25 hover:opacity-95 disabled:opacity-60">
      {pending ? 'Aguarde…' : <>Entrar <IconeAuth nome="seta" className="size-5" /></>}
    </button>
  )
}

function Erro({ id, texto }: { id: string; texto?: string }) {
  return texto ? <p id={id} role="alert" className="text-sm text-despesa">{texto}</p> : null
}

// Sign-in with icons in the fields and a show/hide for the password (labels stay "E-mail" and "Senha").
export function FormLogin({ next }: { next: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(entrar, {})
  const [verSenha, setVerSenha] = useState(false)
  const id = useId()
  const erroEmail = estado.campos?.email?.[0]
  const erroSenha = estado.campos?.senha?.[0]
  return (
    <form action={acao} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <Mensagem estado={estado} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-email`} className="text-sm font-semibold">E-mail</label>
        <div className={caixa}>
          <IconeAuth nome="email" className="size-5 text-tinta-suave" />
          <input id={`${id}-email`} name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
            placeholder="voce@suaagencia.com.br" defaultValue={estado.valores?.email}
            aria-invalid={erroEmail ? true : undefined} aria-describedby={erroEmail ? `${id}-email-erro` : undefined} className={entrada} />
        </div>
        <Erro id={`${id}-email-erro`} texto={erroEmail} />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={`${id}-senha`} className="text-sm font-semibold">Senha</label>
          <Link href="/recuperar" className="text-sm font-medium text-primaria hover:underline">Esqueci a senha</Link>
        </div>
        <div className={caixa}>
          <IconeAuth nome="cadeado" className="size-5 text-tinta-suave" />
          <input id={`${id}-senha`} name="senha" type={verSenha ? 'text' : 'password'} autoComplete="current-password"
            placeholder="Sua senha" aria-invalid={erroSenha ? true : undefined} aria-describedby={erroSenha ? `${id}-senha-erro` : undefined} className={entrada} />
          <button type="button" onClick={() => setVerSenha((v) => !v)} aria-pressed={verSenha} aria-controls={`${id}-senha`}
            title={verSenha ? 'Esconder' : 'Mostrar'} className="-mr-1 inline-flex size-11 items-center justify-center rounded-lg text-tinta-suave hover:bg-superficie-suave hover:text-tinta">
            <IconeAuth nome={verSenha ? 'olhoFechado' : 'olho'} />
            <span className="sr-only">{verSenha ? 'Esconder o que foi digitado' : 'Mostrar o que foi digitado'}</span>
          </button>
        </div>
        <Erro id={`${id}-senha-erro`} texto={erroSenha} />
      </div>
      <BotaoEntrar />
      <p className="text-center text-sm text-tinta-suave">
        Ainda não usa o crTOUR? <Link href="/cadastro" className="font-semibold text-primaria underline-offset-2 hover:underline">Criar conta</Link>
      </p>
    </form>
  )
}
