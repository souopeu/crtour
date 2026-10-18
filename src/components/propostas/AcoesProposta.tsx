'use client'

import { useState, useTransition } from 'react'
import { registrarEnvioProposta, revogarProposta } from '@/app/(app)/negociacoes/propostas-actions'
import type { EstadoForm } from '@/lib/forms'

export function AcoesProposta({ propostaId }: { propostaId: string }) {
  const [estado, setEstado] = useState<EstadoForm>({})
  const [ocupado, iniciar] = useTransition()
  const rodar = (acao: (id: string) => Promise<EstadoForm>) => iniciar(async () => setEstado(await acao(propostaId)))
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={ocupado} onClick={() => rodar(registrarEnvioProposta)} className="min-h-11 rounded-lg border border-controle px-4 text-sm">Registrar envio</button>
      <button type="button" disabled={ocupado} onClick={() => rodar(revogarProposta)} className="min-h-11 px-2 text-sm text-despesa underline">Revogar</button>
      <span role="status" className={`text-sm ${estado.erro ? 'text-despesa' : 'text-receita'}`}>{estado.erro ?? estado.ok ?? ''}</span>
    </div>
  )
}
