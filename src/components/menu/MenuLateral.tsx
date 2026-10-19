'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { COOKIE_LATERAL, VALOR_RECOLHIDA } from '@/lib/menu/config'
import type { GrupoMenu } from '@/lib/menu/menu'
import { IconeMenu } from './IconeMenu'
import { ListaDeItens } from './ListaDeItens'

const UM_ANO = 60 * 60 * 24 * 365

// Wide screens only. The collapsed choice is kept in a cookie so the server renders the right width on the first paint.
export function MenuLateral({ grupos, recolhidoInicial, agencia }: { grupos: GrupoMenu[]; recolhidoInicial: boolean; agencia: string }) {
  const caminho = usePathname()
  const [recolhido, setRecolhido] = useState(recolhidoInicial)

  function alternar() {
    const proximo = !recolhido
    setRecolhido(proximo)
    document.cookie = `${COOKIE_LATERAL}=${proximo ? VALOR_RECOLHIDA : 'aberta'}; path=/; max-age=${UM_ANO}; samesite=lax`
  }

  return (
    <aside className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col bg-fundo-app transition-[width] duration-(--duracao-entrada) lg:flex print:hidden ${recolhido ? 'w-(--lateral-recolhida)' : 'w-(--lateral-largura)'}`}>
      <div className={`flex items-center gap-1 px-2 pt-1 ${recolhido ? 'justify-center' : ''}`}>
        {recolhido ? null : (
          <p className="min-w-0 flex-1 truncate rounded-lg border border-linha bg-superficie px-3 py-2 text-sm font-semibold" title={agencia}>
            <span className="block text-xs font-normal text-tinta-suave">Área de trabalho</span>
            {agencia || 'Sua agência'}
          </p>
        )}
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!recolhido}
          aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-tinta-suave hover:bg-superficie-suave hover:text-tinta"
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
