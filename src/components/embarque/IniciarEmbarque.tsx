'use client'

import { useActionState } from 'react'
import { Mensagem } from '@/components/auth/Mensagem'
import { botaoPrincipal } from '@/components/tela/estilos'
import type { EstadoForm } from '@/lib/forms'

// R141: one button; the database also moves the ready reservations to "em execução".
export function IniciarEmbarque({ acao }: { acao: () => Promise<EstadoForm> }) {
  const [estado, enviar, enviando] = useActionState<EstadoForm>(async () => acao(), {})
  return (
    <form action={enviar} className="flex flex-col gap-2">
      <Mensagem estado={estado} />
      <button type="submit" disabled={enviando} className={`${botaoPrincipal} w-fit disabled:opacity-60`}>
        {enviando ? 'Aguarde…' : 'Iniciar embarque'}
      </button>
    </form>
  )
}
