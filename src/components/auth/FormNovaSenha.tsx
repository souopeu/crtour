'use client'

import { useActionState } from 'react'
import { definirNovaSenha, type EstadoForm } from '@/app/(auth)/actions'
import { BotaoEnviar } from './BotaoEnviar'
import { Campo } from './Campo'
import { Mensagem } from './Mensagem'

export function FormNovaSenha() {
  const [estado, acao] = useActionState<EstadoForm, FormData>(definirNovaSenha, {})
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo nome="senha" rotulo="Nova senha" tipo="password" autoComplete="new-password" dica="Mínimo de 8 caracteres, com letras e números." erros={estado.campos?.senha} />
      <Campo nome="confirmacao" rotulo="Repita a nova senha" tipo="password" autoComplete="new-password" erros={estado.campos?.confirmacao} />
      <BotaoEnviar>Salvar nova senha</BotaoEnviar>
    </form>
  )
}
