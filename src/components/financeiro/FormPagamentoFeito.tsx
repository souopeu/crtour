'use client'

import { useId } from 'react'

const ROTULO_FORMA = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência', outro: 'Outro' } as const
const campo = 'h-10 rounded-lg border border-controle bg-superficie px-2 text-sm'

// Date, form and optional receipt of a payment the agency makes (commissions, suppliers, bills).
export function CamposPagamentoFeito({ hoje, erros }: { hoje: string; erros?: Record<string, string[] | undefined> }) {
  const id = useId()
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label htmlFor={`${id}-data`} className="flex flex-col gap-1 text-xs font-medium text-tinta-suave">
        Pago em
        <input id={`${id}-data`} type="date" name="data" defaultValue={hoje} className={`${campo} text-tinta`} />
        {erros?.data?.[0] && <span role="alert" className="text-despesa">{erros.data[0]}</span>}
      </label>
      <label htmlFor={`${id}-forma`} className="flex flex-col gap-1 text-xs font-medium text-tinta-suave">
        Forma
        <select id={`${id}-forma`} name="forma" defaultValue="pix" className={`${campo} text-tinta`}>
          {Object.entries(ROTULO_FORMA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </label>
      <label htmlFor={`${id}-comp`} className="flex flex-col gap-1 text-xs font-medium text-tinta-suave">
        Comprovante (opcional: PDF, JPG ou PNG, até 4 MB)
        <input id={`${id}-comp`} type="file" name="comprovante" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="text-sm text-tinta" />
      </label>
    </div>
  )
}
