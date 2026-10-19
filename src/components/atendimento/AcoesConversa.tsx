'use client'

import { useActionState, useState } from 'react'
import { arquivarConversa, assumirConversa, transferirConversa } from '@/app/(app)/atendimento/actions'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'
import type { MembroLinha } from '@/lib/negociacoes/dados'

const botao = 'inline-flex min-h-11 items-center rounded-lg border border-controle px-3 text-sm font-medium disabled:opacity-60'

type Props = { id: string; meuId: string; responsavelId: string | null; arquivada: boolean; membros: MembroLinha[] }

// R104: take, hand over, archive. Each button shows the result next to it.
export function AcoesConversa({ id, meuId, responsavelId, arquivada, membros }: Props) {
  const [assumido, assumir, assumindo] = useActionState<EstadoForm>(assumirConversa.bind(null, id), {})
  const [transferido, transferir, transferindo] = useActionState<EstadoForm, FormData>(transferirConversa.bind(null, id), {})
  const [arquivado, arquivar, arquivando] = useActionState<EstadoForm>(arquivarConversa.bind(null, id), {})
  const outros = membros.filter((m) => m.user_id !== responsavelId && m.user_id !== meuId)
  const [para, setPara] = useState(outros[0]?.user_id ?? '')
  const estado = [transferido, assumido, arquivado].find((e) => e.erro || e.ok) ?? {}
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        {responsavelId !== meuId && (
          <form action={assumir}><button type="submit" disabled={assumindo} className={`${botao} bg-marca text-white`}>Assumir</button></form>
        )}
        {outros.length > 0 && (
          <form action={transferir} className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={`para-${id}`} className="text-xs font-medium text-tinta-suave">Passar para</label>
              <select id={`para-${id}`} name="para" value={para} onChange={(e) => setPara(e.target.value)} className="h-11 rounded-lg border border-controle bg-superficie px-2 text-sm">
                {outros.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
              </select>
              <input type="hidden" name="para_nome" value={outros.find((m) => m.user_id === para)?.nome ?? ''} />
            </div>
            <button type="submit" disabled={transferindo} className={botao}>Transferir</button>
          </form>
        )}
        {!arquivada && (
          <form action={arquivar}><button type="submit" disabled={arquivando} className={botao}>Arquivar</button></form>
        )}
      </div>
      <Mensagem estado={estado} />
    </div>
  )
}
