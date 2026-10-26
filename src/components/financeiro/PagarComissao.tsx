'use client'

import { useActionState, useId, useState } from 'react'
import { pagarComissao } from '@/app/(app)/financeiro/pagamentos-actions'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'
import { CamposPagamentoFeito } from './FormPagamentoFeito'

// R149: registers what was paid to a seller for a month; the value starts as what is still to settle.
export function PagarComissao({ vendedorId, nome, mes, sugerido, hoje }: { vendedorId: string; nome: string; mes: string; sugerido: string; hoje: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoForm, FormData>(pagarComissao, {})
  const [aberto, setAberto] = useState(false)
  const id = useId()
  if (!aberto && !estado.erro && !estado.campos) {
    return <button type="button" onClick={() => setAberto(true)} className="min-h-9 rounded-lg border border-controle bg-superficie px-3 text-sm hover:bg-superficie-suave">Registrar pagamento</button>
  }
  return (
    <form action={enviar} aria-label={`Pagamento da comissão de ${nome}`} className="flex flex-col gap-2 rounded-lg border border-linha bg-superficie-suave p-3">
      <Mensagem estado={estado} />
      <input type="hidden" name="vendedor" value={vendedorId} />
      <input type="hidden" name="mes" value={mes} />
      <label htmlFor={`${id}-valor`} className="flex max-w-40 flex-col gap-1 text-xs font-medium text-tinta-suave">
        Valor (R$)
        <input id={`${id}-valor`} name="valor" defaultValue={sugerido} inputMode="decimal" className="h-10 rounded-lg border border-controle bg-superficie px-2 text-sm text-tinta" />
        {estado.campos?.valor?.[0] && <span role="alert" className="text-despesa">{estado.campos.valor[0]}</span>}
      </label>
      <CamposPagamentoFeito hoje={hoje} erros={estado.campos} />
      <div className="flex gap-2">
        <button type="submit" disabled={enviando} className="min-h-10 rounded-lg bg-marca px-4 text-sm font-semibold text-white disabled:opacity-60">{enviando ? 'Aguarde…' : 'Confirmar pagamento'}</button>
        <button type="button" onClick={() => setAberto(false)} className="min-h-10 px-3 text-sm underline">Cancelar</button>
      </div>
    </form>
  )
}
