'use client'

import { useActionState } from 'react'
import { definirVendedor } from '@/app/(app)/comissoes/actions'
import type { EstadoForm } from '@/lib/forms'

type Props = { reservaId: string; vendedorId: string | null; membros: { user_id: string; nome: string }[]; podeMudar: boolean }

export function VendidoPor({ reservaId, vendedorId, membros, podeMudar }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(definirVendedor.bind(null, reservaId), {})
  const nome = membros.find((m) => m.user_id === vendedorId)?.nome ?? 'ninguém'
  if (!podeMudar) return <p className="text-sm text-tinta-suave">Vendido por: {nome}</p>
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="mt-1 flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="vendedor" className="text-tinta-suave">Vendido por</label>
      <select id="vendedor" name="vendedor" defaultValue={vendedorId ?? ''} className="h-11 rounded-xl border border-controle bg-superficie px-2">
        <option value="">Ninguém</option>
        {membros.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
      </select>
      <button type="submit" className="min-h-11 rounded-full border border-controle px-4 font-semibold">Salvar vendedor(a)</button>
      {estado.erro && <span role="alert" className="text-despesa">{estado.erro}</span>}
      {estado.ok && <span role="status" className="text-receita">{estado.ok}</span>}
    </form>
  )
}
