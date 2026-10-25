'use client'

import { useActionState, useState } from 'react'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'
import { STATUS_OPERACIONAL, ehVolta, rotuloDoStatus, type StatusOperacional as Status } from '@/lib/reservas/status'
import { COR_STATUS } from './ChipStatus'

type Props = { atual: Status; acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm> }

// R136: one click moves forward (even skipping steps); going back asks first, inline (no window.confirm).
export function StatusOperacional({ atual, acao }: Props) {
  const [estado, enviar, enviando] = useActionState(acao, {})
  const [volta, setVolta] = useState<Status | null>(null)

  return (
    <section aria-labelledby="status-titulo" className="flex flex-col gap-2">
      <h2 id="status-titulo" className="text-lg font-semibold">Status da operação</h2>
      <Mensagem estado={estado} />
      <form action={enviar}>
        <ol className="flex flex-wrap gap-1.5">
          {STATUS_OPERACIONAL.map((s) => {
            const corrente = s === atual
            const voltar = ehVolta(atual, s)
            return (
              <li key={s}>
                <button
                  type={voltar ? 'button' : 'submit'}
                  name={voltar ? undefined : 'status'}
                  value={s}
                  disabled={corrente || enviando}
                  aria-current={corrente ? 'step' : undefined}
                  onClick={voltar ? () => setVolta(s) : undefined}
                  className={`min-h-11 rounded-lg border px-3 text-sm ${corrente ? `border-transparent font-semibold ${COR_STATUS[s]}` : 'border-controle bg-superficie hover:bg-superficie-suave'} disabled:cursor-default`}
                >
                  {rotuloDoStatus(s)}
                </button>
              </li>
            )
          })}
        </ol>
      </form>
      {volta && (
        <form action={(fd) => { setVolta(null); enviar(fd) }} className="flex flex-col gap-2 rounded-(--radius-cartao) border border-alerta bg-alerta-suave p-3">
          <input type="hidden" name="status" value={volta} />
          <input type="hidden" name="voltar" value="1" />
          <p role="alert" className="text-sm text-alerta">Voltar de {rotuloDoStatus(atual)} para {rotuloDoStatus(volta)}?</p>
          <div className="flex gap-3">
            <button type="submit" className="min-h-11 rounded-full bg-marca px-4 text-sm font-semibold text-white">Voltar mesmo</button>
            <button type="button" onClick={() => setVolta(null)} className="min-h-11 px-4 text-sm underline">Cancelar</button>
          </div>
        </form>
      )}
    </section>
  )
}
