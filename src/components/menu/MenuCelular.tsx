'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import type { GrupoMenu, IdGrupo } from '@/lib/menu/menu'
import { ListaDeItens } from './ListaDeItens'

// Narrow screens: a "Menu" button (native <details>, works without JavaScript) that closes after navigating.
export function MenuCelular({ grupos, fechadosIniciais }: { grupos: GrupoMenu[]; fechadosIniciais: readonly IdGrupo[] }) {
  const caminho = usePathname()
  const menu = useRef<HTMLDetailsElement>(null)
  useEffect(() => { if (menu.current) menu.current.open = false }, [caminho])
  return (
    <details ref={menu} className="relative lg:hidden">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-full border border-linha bg-superficie px-4">Menu</summary>
      <nav aria-label="Principal" className="absolute right-0 z-20 mt-2 max-h-[calc(100dvh-6rem)] w-64 overflow-y-auto rounded-(--radius-cartao) border border-linha bg-superficie p-2 text-tinta shadow-lg">
        <ListaDeItens grupos={grupos} caminho={caminho} fechadosIniciais={fechadosIniciais} />
      </nav>
    </details>
  )
}
