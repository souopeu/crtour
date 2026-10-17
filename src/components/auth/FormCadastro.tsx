'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { cadastrar, type EstadoForm } from '@/app/(auth)/actions'
import { BotaoEnviar } from './BotaoEnviar'
import { Campo } from './Campo'
import { Mensagem } from './Mensagem'

export function FormCadastro() {
  const [estado, acao] = useActionState<EstadoForm, FormData>(cadastrar, {})
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo nome="agenciaNome" rotulo="Nome da agência" autoComplete="organization" valor={estado.valores?.agenciaNome} erros={estado.campos?.agenciaNome} />
      <Campo nome="email" rotulo="E-mail" tipo="email" autoComplete="email" valor={estado.valores?.email} erros={estado.campos?.email} />
      <Campo nome="senha" rotulo="Senha" tipo="password" autoComplete="new-password" dica="Mínimo de 8 caracteres, com letras e números." erros={estado.campos?.senha} />
      <div className="flex flex-col gap-1">
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" name="aceite" className="mt-1 size-5" />
          <span>
            Li e aceito os <Link href="/termos" className="text-primaria underline">termos de uso</Link> e a{' '}
            <Link href="/privacidade" className="text-primaria underline">política de privacidade</Link>.
          </span>
        </label>
        {estado.campos?.aceite?.length ? (
          <p role="alert" className="text-sm text-despesa">{estado.campos.aceite[0]}</p>
        ) : null}
      </div>
      <BotaoEnviar>Criar conta</BotaoEnviar>
      <p className="text-sm">
        Já tem conta? <Link href="/login" className="text-primaria underline">Entrar</Link>
      </p>
    </form>
  )
}
