'use client'

import { useActionState, useId } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import { formatarDataBr } from '@/lib/formato'
import type { EstadoForm } from '@/lib/forms'

export type OpcaoDestino = { id: string; data: string; horario: string | null; livres: number }

// R140: pick another departure of the same tour (the list already has only those with room).
// A native <details> keeps it closed by default and works without JavaScript.
export function MoverReserva({ acao, destinos, compacto = false }: {
  acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>; destinos: OpcaoDestino[]; compacto?: boolean
}) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const id = useId()
  return (
    <details className="w-full" open={Boolean(estado.erro)}>
      <summary className={`inline-flex cursor-pointer items-center text-sm text-primaria underline ${compacto ? 'min-h-9' : 'min-h-11'}`}>Mover para outra saída</summary>
      <div className="mt-2 flex flex-col gap-2">
        <Mensagem estado={estado} />
        {destinos.length === 0 ? (
          <p className="text-sm text-tinta-suave">Não há outra saída aberta deste passeio, de hoje em diante, com lugar para esta reserva.</p>
        ) : (
          <form action={enviar} className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-saida`} className="text-xs font-medium text-tinta-suave">Saída de destino</label>
              <select id={`${id}-saida`} name="saida" className="h-11 rounded-lg border border-controle bg-superficie px-2 text-sm">
                {destinos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatarDataBr(d.data)}{d.horario ? ` · ${d.horario.slice(0, 5)}` : ''} · {d.livres} {d.livres === 1 ? 'lugar livre' : 'lugares livres'}
                  </option>
                ))}
              </select>
            </div>
            <BotaoEnviar>Mover</BotaoEnviar>
          </form>
        )}
      </div>
    </details>
  )
}
