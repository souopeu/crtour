'use client'

import { useActionState } from 'react'
import { anexarComprovante, removerComprovante } from '@/app/(app)/reservas/comprovantes-actions'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

// R93: one receipt per payment; personal documents are not allowed (LGPD decision of 17/10/2026).
export function Comprovante({ reservaId, pagamentoId, temComprovante }: { reservaId: string; pagamentoId: string; temComprovante: boolean }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(anexarComprovante.bind(null, reservaId, pagamentoId), {})
  const id = `comprovante-${pagamentoId}`
  return (
    <div className="flex flex-col gap-2 border-t border-linha pt-2">
      {temComprovante && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <a href={`/reservas/comprovante/${pagamentoId}`} target="_blank" rel="noopener noreferrer" className="text-primaria underline">Ver comprovante</a>
          <form action={removerComprovante.bind(null, reservaId, pagamentoId)}>
            <button type="submit" className="min-h-10 rounded-lg border border-despesa px-3 text-despesa">Remover comprovante</button>
          </form>
        </div>
      )}
      <form key={estado.versao ?? 'inicial'} action={enviar} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-xs font-medium text-tinta-suave">Comprovante (PDF, JPG ou PNG, até 4 MB)</label>
          <input id={id} name="arquivo" type="file" required accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            aria-describedby={`${id}-dica`} className="max-w-full text-sm" />
          <p id={`${id}-dica`} className="text-xs text-tinta-suave">Só comprovante de pagamento. Não anexe documentos pessoais (RG, passaporte).</p>
        </div>
        <button type="submit" className="min-h-10 rounded-lg border border-controle px-3 text-sm">{temComprovante ? 'Trocar comprovante' : 'Anexar comprovante'}</button>
      </form>
      <Mensagem estado={estado} />
    </div>
  )
}
