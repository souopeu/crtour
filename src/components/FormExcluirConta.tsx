'use client'

import { useActionState } from 'react'
import { excluirConta } from '@/app/(app)/configuracoes/actions'
import { Campo } from '@/components/auth/Campo'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

export function FormExcluirConta() {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(excluirConta, {})
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex max-w-sm flex-col gap-3">
      <Mensagem estado={estado} />
      <Campo nome="confirmacao" rotulo="Digite EXCLUIR para confirmar" autoComplete="off" erros={estado.campos?.confirmacao} />
      <Campo nome="senha" rotulo="Sua senha" tipo="password" autoComplete="current-password" erros={estado.campos?.senha} />
      <button type="submit" className="min-h-12 w-fit rounded-full bg-despesa px-6 font-semibold text-white">Excluir conta e todos os dados</button>
    </form>
  )
}
