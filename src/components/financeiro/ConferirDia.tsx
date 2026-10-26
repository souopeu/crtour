'use client'

import { useActionState } from 'react'
import { conferirDia } from '@/app/(app)/financeiro/conferencia/actions'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

// R151: "Conferi este dia", with an optional note.
export function ConferirDia({ dia, observacao, rotulo }: { dia: string; observacao: string | null; rotulo: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoForm, FormData>(conferirDia, {})
  return (
    <form action={enviar} aria-label="Conferir o dia" className="flex flex-col gap-2">
      <Mensagem estado={estado} />
      <input type="hidden" name="dia" value={dia} />
      <label className="flex flex-col gap-1 text-xs font-medium text-tinta-suave">
        Observação (opcional)
        <textarea name="observacao" rows={2} maxLength={500} defaultValue={estado.valores?.observacao ?? observacao ?? ''}
          className="rounded-lg border border-controle bg-superficie px-3 py-2 text-sm text-tinta" />
        {estado.campos?.observacao?.[0] && <span role="alert" className="text-despesa">{estado.campos.observacao[0]}</span>}
      </label>
      <button type="submit" disabled={enviando} className="min-h-11 w-fit rounded-lg bg-marca px-4 text-sm font-semibold text-white disabled:opacity-60">
        {enviando ? 'Aguarde…' : rotulo}
      </button>
    </form>
  )
}
