'use client'

import { useActionState, useState } from 'react'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

type Props = { acao: () => Promise<EstadoForm>; rotulo: string; aviso: string }

// Inline confirmation (no window.confirm, which browsers can block).
export function ConfirmarExclusao({ acao, rotulo, aviso }: Props) {
  const [aberto, setAberto] = useState(false)
  const [estado, enviar] = useActionState<EstadoForm>(async () => acao(), {})
  if (!aberto) {
    return <button type="button" onClick={() => setAberto(true)} className="min-h-11 w-fit text-despesa underline">{rotulo}</button>
  }
  return (
    <form action={enviar} className="flex max-w-xl flex-col gap-2">
      <Mensagem estado={estado} />
      <p role="alert" className="text-sm text-despesa">{aviso}</p>
      <div className="flex gap-3">
        <button type="submit" className="min-h-11 rounded-full bg-despesa px-4 font-semibold text-white">Excluir mesmo</button>
        <button type="button" onClick={() => setAberto(false)} className="min-h-11 px-4 underline">Cancelar</button>
      </div>
    </form>
  )
}
