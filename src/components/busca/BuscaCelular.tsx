'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { BuscaGlobal } from './BuscaGlobal'

// Narrow screens: a search icon (native <details>, like the menu) that opens the field below the header.
export function BuscaCelular() {
  const caminho = usePathname()
  const painel = useRef<HTMLDetailsElement>(null)
  useEffect(() => { if (painel.current) painel.current.open = false }, [caminho])
  return (
    <details
      ref={painel}
      className="lg:hidden"
      onToggle={(e) => { if (e.currentTarget.open) e.currentTarget.querySelector('input')?.focus() }}
    >
      <summary aria-label="Buscar" className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-linha bg-superficie">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" className="size-5">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </summary>
      <div className="fixed inset-x-4 top-16 z-20 rounded-(--radius-cartao) border border-linha bg-superficie p-2 shadow-lg">
        <BuscaGlobal />
      </div>
    </details>
  )
}
