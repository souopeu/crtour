'use client'

import { useActionState, useId } from 'react'
import type { EstadoForm } from '@/lib/forms'

type Props = { acao: (estado: EstadoForm, fd: FormData) => Promise<EstadoForm>; rotulo: string; inicial: string; sufixo?: string }

// One small inline form per value (person %, tour %, tour R$/passenger), each with its own message.
export function FormValor({ acao, rotulo, inicial, sufixo }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const id = useId()
  const erro = estado.campos?.valor?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="min-w-40 text-sm">{rotulo}</label>
      <input id={id} name="valor" inputMode="decimal" defaultValue={estado.valores?.valor ?? inicial} aria-invalid={erro ? true : undefined}
        className="h-11 w-28 rounded-xl border border-controle bg-superficie px-3 text-base" />
      {sufixo && <span className="text-sm text-tinta-suave">{sufixo}</span>}
      <button type="submit" className="min-h-11 rounded-full border border-controle px-4 text-sm font-semibold">Salvar</button>
      {erro && <span role="alert" className="text-sm text-despesa">{erro}</span>}
      {estado.erro && <span role="alert" className="text-sm text-despesa">{estado.erro}</span>}
      {estado.ok && <span role="status" className="text-sm text-receita">{estado.ok}</span>}
    </form>
  )
}
