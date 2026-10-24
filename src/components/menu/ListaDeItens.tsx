'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import { COOKIE_GRUPOS } from '@/lib/menu/config'
import { alternarGrupo, gravarGruposFechados, grupoAberto, itemAtivo, type GrupoMenu, type IdGrupo, type ItemMenu } from '@/lib/menu/menu'
import { IconeMenu } from './IconeMenu'

const UM_ANO = 60 * 60 * 24 * 365

function lembrarFechados(fechados: ReadonlySet<IdGrupo>) {
  document.cookie = `${COOKIE_GRUPOS}=${gravarGruposFechados(fechados)}; path=/; max-age=${UM_ANO}; samesite=lax`
}

function Entrada({ item, caminho, recolhido }: { item: ItemMenu; caminho: string; recolhido: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={itemAtivo(caminho, item) ? 'page' : undefined}
        title={recolhido ? item.rotulo : undefined}
        className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-superficie-suave aria-[current=page]:bg-primaria-suave aria-[current=page]:font-semibold aria-[current=page]:text-primaria ${recolhido ? 'justify-center' : ''}`}
      >
        <IconeMenu nome={item.icone} />
        <span className={recolhido ? 'sr-only' : ''}>{item.rotulo}</span>
        {item.novos ? (
          <span
            aria-label={`${item.novos} novos`}
            className={`rounded-full bg-destaque px-2 text-xs font-bold text-destaque-texto ${recolhido ? 'absolute right-1 top-1 px-1.5' : 'ml-auto'}`}
          >
            {item.novos}
          </span>
        ) : null}
      </Link>
    </li>
  )
}

// Shared by the sidebar and the phone drawer. `recolhido` keeps only the icons (every entry, no group titles);
// names stay available to screen readers. R133: titled groups open and close, and the choice is kept in a cookie.
export function ListaDeItens({ grupos, caminho, recolhido = false, fechadosIniciais = [] }: {
  grupos: GrupoMenu[]; caminho: string; recolhido?: boolean; fechadosIniciais?: readonly IdGrupo[]
}) {
  const base = useId()
  const [fechados, setFechados] = useState<ReadonlySet<IdGrupo>>(() => new Set(fechadosIniciais))

  function alternar(id: IdGrupo) {
    const proximo = alternarGrupo(fechados, id)
    setFechados(proximo)
    lembrarFechados(proximo)
  }

  return grupos.map((grupo, i) => {
    const aberto = recolhido || grupoAberto(grupo, caminho, fechados)
    const lista = `${base}-${grupo.id ?? 'topo'}`
    return (
      <div key={grupo.id ?? 'topo'} className={i > 0 ? 'mt-2 border-t border-linha pt-2' : ''}>
        {grupo.id && !recolhido ? (
          <button
            type="button"
            onClick={() => alternar(grupo.id as IdGrupo)}
            aria-expanded={aberto}
            aria-controls={lista}
            className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-xs font-semibold uppercase tracking-wide text-tinta-suave hover:bg-superficie-suave hover:text-tinta"
          >
            {grupo.titulo}
            <IconeMenu nome="recolher" className={`size-4 motion-safe:transition-transform ${aberto ? '-rotate-90' : 'rotate-180'}`} />
          </button>
        ) : null}
        <ul id={lista} hidden={!aberto} className="flex flex-col gap-0.5">
          {grupo.itens.map((item) => <Entrada key={item.href} item={item} caminho={caminho} recolhido={recolhido} />)}
        </ul>
      </div>
    )
  })
}
