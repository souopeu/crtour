'use client'

import { useState } from 'react'

type Props = { id: string; titulo: string; quantidade: number; resumo: React.ReactNode; borda: string; children: React.ReactNode }

// R61: a table group with a coloured left edge that folds open and closed.
export function GrupoRecolhivel({ id, titulo, quantidade, resumo, borda, children }: Props) {
  const [aberto, setAberto] = useState(true)
  return (
    <section aria-labelledby={id} className={`rounded-(--radius-cartao) border border-l-4 border-linha bg-superficie ${borda}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-1">
        <h2 id={id} className="text-base font-semibold">
          <button type="button" aria-expanded={aberto} aria-controls={`${id}-corpo`} onClick={() => setAberto(!aberto)} className="inline-flex min-h-11 items-center gap-2">
            <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-4 transition-transform duration-(--duracao-entrada) ${aberto ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
            {titulo} ({quantidade})
          </button>
        </h2>
        <p className="text-sm text-tinta-suave">{resumo}</p>
      </header>
      <div id={`${id}-corpo`} hidden={!aberto} className="overflow-x-auto border-t border-linha">{children}</div>
    </section>
  )
}
