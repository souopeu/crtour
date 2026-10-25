'use client'

import { useActionState, useId } from 'react'
import { formatarDataHora } from '@/lib/formato'
import type { EstadoForm } from '@/lib/forms'

type Props = {
  acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>
  nome: string; detalhe: string; passageiroId: string | null; vaga: number
  embarcouEm: string | null; marcadoPor: string | null
}

// R141: one person = one big toggle (44 px+, phone-first). Pressing it marks or unmarks; the database keeps who and when.
export function LugarEmbarque({ acao, nome, detalhe, passageiroId, vaga, embarcouEm, marcadoPor }: Props) {
  const [estado, enviar, enviando] = useActionState<EstadoForm, FormData>(acao, {})
  const embarcou = embarcouEm !== null
  const id = useId()
  return (
    <form action={enviar}>
      <input type="hidden" name="passageiro" value={passageiroId ?? ''} />
      <input type="hidden" name="vaga" value={vaga} />
      <input type="hidden" name="embarcou" value={embarcou ? '0' : '1'} />
      <button
        type="submit"
        role="checkbox"
        aria-checked={embarcou}
        aria-label={nome}
        aria-describedby={`${id}-detalhe`}
        disabled={enviando}
        className={`flex min-h-14 w-full items-center gap-3 rounded-(--radius-cartao) border px-3 py-2 text-left disabled:opacity-60 ${embarcou ? 'border-receita bg-receita-suave' : 'border-linha bg-superficie hover:bg-superficie-suave'}`}
      >
        <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold ${embarcou ? 'border-receita bg-receita text-white' : 'border-controle'}`}>
          {embarcou ? '✓' : ''}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{nome}</span>
          <span id={`${id}-detalhe`} className="text-sm text-tinta-suave">
            {detalhe}
            {embarcou && ` · embarcou ${formatarDataHora(embarcouEm).slice(11)}${marcadoPor ? ` · marcado por ${marcadoPor}` : ''}`}
          </span>
        </span>
      </button>
      {estado.erro && <p role="alert" className="mt-1 text-sm text-despesa">{estado.erro}</p>}
    </form>
  )
}
