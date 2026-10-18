'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { APP_NAME } from '@/lib/brand'
import { COOKIE_LATERAL, VALOR_RECOLHIDA } from '@/lib/menu/config'
import type { GrupoMenu } from '@/lib/menu/menu'
import { IconeMenu } from './IconeMenu'
import { ListaDeItens } from './ListaDeItens'

const UM_ANO = 60 * 60 * 24 * 365

// Wide screens only. The collapsed choice is kept in a cookie so the server renders the right width on the first paint.
export function MenuLateral({ grupos, recolhidoInicial }: { grupos: GrupoMenu[]; recolhidoInicial: boolean }) {
  const caminho = usePathname()
  const [recolhido, setRecolhido] = useState(recolhidoInicial)

  function alternar() {
    const proximo = !recolhido
    setRecolhido(proximo)
    document.cookie = `${COOKIE_LATERAL}=${proximo ? VALOR_RECOLHIDA : 'aberta'}; path=/; max-age=${UM_ANO}; samesite=lax`
  }

  return (
    <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-linha bg-superficie transition-[width] duration-(--duracao-entrada) lg:flex print:hidden ${recolhido ? 'w-(--lateral-recolhida)' : 'w-(--lateral-largura)'}`}>
      <div className={`flex min-h-14 items-center bg-marca px-3 ${recolhido ? 'justify-center' : 'justify-between'}`}>
        {recolhido ? null : <span className="text-xl font-extrabold tracking-tight text-destaque">{APP_NAME}</span>}
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!recolhido}
          aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
          className="inline-flex size-11 items-center justify-center rounded-lg text-white hover:bg-white/15"
        >
          <IconeMenu nome="recolher" className={`size-5 transition-transform ${recolhido ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <nav aria-label="Principal" className="flex-1 overflow-y-auto p-2">
        <ListaDeItens grupos={grupos} caminho={caminho} recolhido={recolhido} />
      </nav>
    </aside>
  )
}
