'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { recuperar, type EstadoForm } from '@/app/(auth)/actions'
import { BotaoEnviar } from './BotaoEnviar'
import { Campo } from './Campo'
import { Mensagem } from './Mensagem'

export function FormRecuperar() {
  const [estado, acao] = useActionState<EstadoForm, FormData>(recuperar, {})
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo nome="email" rotulo="E-mail" tipo="email" autoComplete="email" valor={estado.valores?.email} erros={estado.campos?.email} />
      <BotaoEnviar>Enviar link</BotaoEnviar>
      <Link href="/login" className="text-sm text-primaria underline">Voltar para o login</Link>
    </form>
  )
}
