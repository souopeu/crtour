'use client'

import { useState } from 'react'

export function CampoCopiar({ id, rotulo, valor }: { id: string; rotulo: string; valor: string }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(true)
    } catch {
      setCopiado(false) // no clipboard permission: the field is selectable by hand
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
      <div className="flex flex-wrap items-center gap-2">
        <input id={id} readOnly value={valor} onFocus={(e) => e.currentTarget.select()} className="h-11 min-w-0 flex-1 rounded-lg border border-controle bg-superficie-suave px-3 text-sm" />
        <button type="button" onClick={copiar} className="min-h-11 rounded-lg border border-controle px-4 text-sm">Copiar</button>
        <span role="status" className="text-sm text-receita">{copiado ? 'Copiado.' : ''}</span>
      </div>
    </div>
  )
}
