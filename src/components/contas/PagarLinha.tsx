'use client'

import { useActionState, useId, useState } from 'react'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

const ROTULO_FORMA = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência', outro: 'Outro' } as const

// Pay from the list or the bill page: date (today by default), form of payment and an optional receipt (E10-2).
export function PagarLinha({ acao, hoje, descricao }: {
  acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>; hoje: string; descricao: string
}) {
  const [estado, enviar, enviando] = useActionState<EstadoForm, FormData>(acao, {})
  const [aberto, setAberto] = useState(false)
  const id = useId()
  if (!aberto) {
    return <button type="button" onClick={() => setAberto(true)} aria-label={`Pagar ${descricao}`} className="min-h-9 rounded-lg border border-controle bg-superficie px-3 text-sm hover:bg-superficie-suave">Pagar</button>
  }
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-0.5 text-xs text-tinta-suave" htmlFor={`${id}-data`}>
        Pago em
        <input id={`${id}-data`} type="date" name="data" defaultValue={hoje} className="h-9 rounded-lg border border-controle bg-superficie px-2 text-sm text-tinta" />
      </label>
      <label className="flex flex-col gap-0.5 text-xs text-tinta-suave" htmlFor={`${id}-forma`}>
        Forma
        <select id={`${id}-forma`} name="forma" defaultValue="pix" className="h-9 rounded-lg border border-controle bg-superficie px-2 text-sm text-tinta">
          {Object.entries(ROTULO_FORMA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-xs text-tinta-suave" htmlFor={`${id}-comp`}>
        Comprovante (opcional)
        <input id={`${id}-comp`} type="file" name="comprovante" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="text-sm text-tinta" />
      </label>
      <button type="submit" disabled={enviando} className="min-h-9 rounded-lg bg-marca px-3 text-sm font-semibold text-white disabled:opacity-60">Confirmar</button>
      <button type="button" onClick={() => setAberto(false)} className="min-h-9 px-2 text-sm underline">Cancelar</button>
      <div className="basis-full"><Mensagem estado={estado} /></div>
    </form>
  )
}
