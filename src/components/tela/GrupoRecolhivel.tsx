'use client'

import { useState } from 'react'

type Props = { id: string; titulo: string; quantidade: number; resumo: React.ReactNode; borda: string; cor: string; children: React.ReactNode }

// R61/R119: a monday-like group — coloured title with a chevron above a table framed by the same colour on the left.
// The title is large bold text (20px), so the stage border tokens (3:1 on the page) are enough contrast.
export function GrupoRecolhivel({ id, titulo, quantidade, resumo, borda, cor, children }: Props) {
  const [aberto, setAberto] = useState(true)
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className={`text-xl font-bold ${cor}`}>
          <button type="button" aria-expanded={aberto} aria-controls={`${id}-corpo`} onClick={() => setAberto(!aberto)} className="inline-flex min-h-11 items-center gap-2">
            <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-5 transition-transform duration-(--duracao-entrada) ${aberto ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6" /></svg>
            {titulo} <span className="font-normal text-tinta-suave">({quantidade})</span>
          </button>
        </h2>
        <p className="text-sm text-tinta-suave">{resumo}</p>
      </header>
      <div id={`${id}-corpo`} hidden={!aberto} className={`overflow-x-auto rounded-(--radius-cartao) border border-l-4 border-linha bg-superficie ${borda}`}>{children}</div>
    </section>
  )
}
