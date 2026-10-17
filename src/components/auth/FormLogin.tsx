'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { entrar, type EstadoForm } from '@/app/(auth)/actions'
import { BotaoEnviar } from './BotaoEnviar'
import { Campo } from './Campo'
import { Mensagem } from './Mensagem'

export function FormLogin({ next }: { next: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(entrar, {})
  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Mensagem estado={estado} />
      <Campo nome="email" rotulo="E-mail" tipo="email" autoComplete="email" valor={estado.valores?.email} erros={estado.campos?.email} />
      <Campo nome="senha" rotulo="Senha" tipo="password" autoComplete="current-password" erros={estado.campos?.senha} />
      <BotaoEnviar>Entrar</BotaoEnviar>
      <div className="flex justify-between text-sm">
        <Link href="/recuperar" className="text-primaria underline">Esqueci a senha</Link>
        <Link href="/cadastro" className="text-primaria underline">Criar conta</Link>
      </div>
    </form>
  )
}
