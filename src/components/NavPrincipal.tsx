'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export type ItemMenu = { href: string; rotulo: string; novos?: number }

const ativo = (pathname: string, href: string) => (href === '/' ? pathname === '/' || pathname.startsWith('/clientes') : pathname.startsWith(href))

function Itens({ itens, pathname, classe }: { itens: ItemMenu[]; pathname: string; classe: string }) {
  return itens.map((i) => (
    <Link key={i.href} href={i.href} aria-current={ativo(pathname, i.href) ? 'page' : undefined} className={`${classe} aria-[current=page]:font-bold`}>
      {i.rotulo}
      {i.novos ? <span className="ml-1 rounded-full bg-destaque px-2 text-xs font-bold text-destaque-texto" aria-label={`${i.novos} novos`}>{i.novos}</span> : null}
    </Link>
  ))
}

// Wide screens: one row. Narrow screens: a "Menu" button (native <details>, works without JavaScript) that closes after navigating.
export function NavPrincipal({ itens }: { itens: ItemMenu[] }) {
  const pathname = usePathname()
  const menu = useRef<HTMLDetailsElement>(null)
  useEffect(() => { if (menu.current) menu.current.open = false }, [pathname])
  return (
    <>
      <nav aria-label="Principal" className="hidden items-center gap-3 lg:flex">
        <Itens itens={itens} pathname={pathname} classe="inline-flex min-h-11 items-center underline" />
      </nav>
      <details ref={menu} className="relative lg:hidden">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-full border border-white/40 px-4">Menu</summary>
        <nav aria-label="Principal" className="absolute right-0 z-20 mt-2 flex w-56 flex-col rounded-[--radius-cartao] border border-linha bg-superficie p-2 text-tinta shadow-lg">
          <Itens itens={itens} pathname={pathname} classe="flex min-h-11 items-center rounded-lg px-3 hover:bg-superficie-suave" />
        </nav>
      </details>
    </>
  )
}
