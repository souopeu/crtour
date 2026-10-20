'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { lerSino, type ItemSino } from '@/app/(app)/avisos/actions'
import { IconeMenu } from '@/components/menu/IconeMenu'

const UM_MINUTO = 60_000

// R130: bell in the top bar with the unread count and the 10 newest notices; refreshes every minute while the tab is visible.
export function Sino({ naoLidosInicial }: { naoLidosInicial: number }) {
  const caminho = usePathname()
  const painel = useRef<HTMLDetailsElement>(null)
  const [naoLidos, setNaoLidos] = useState(naoLidosInicial)
  const [itens, setItens] = useState<ItemSino[] | null>(null)

  useEffect(() => {
    let vivo = true
    const atualizar = () => {
      if (document.visibilityState !== 'visible') return
      lerSino().then((r) => { if (vivo) { setNaoLidos(r.naoLidos); setItens(r.itens) } }).catch(() => {})
    }
    atualizar()
    const id = setInterval(atualizar, UM_MINUTO)
    document.addEventListener('visibilitychange', atualizar)
    return () => { vivo = false; clearInterval(id); document.removeEventListener('visibilitychange', atualizar) }
  }, [caminho])

  useEffect(() => { if (painel.current) painel.current.open = false }, [caminho])

  return (
    <details ref={painel} className="relative">
      <summary
        aria-label={naoLidos ? `Notificações, ${naoLidos} ${naoLidos === 1 ? 'nova' : 'novas'}` : 'Notificações'}
        className="relative inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-full text-tinta-suave hover:bg-superficie-suave hover:text-tinta"
      >
        <IconeMenu nome="avisos" className="size-5" />
        {naoLidos > 0 && <span aria-hidden="true" className="absolute right-1 top-1 rounded-full bg-despesa px-1.5 text-xs font-bold text-white">{naoLidos}</span>}
      </summary>
      <div className="fixed inset-x-4 top-16 z-40 flex max-h-[70dvh] flex-col rounded-(--radius-cartao) border border-linha bg-superficie text-tinta shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
        <p className="border-b border-linha px-4 py-3 font-semibold">Notificações</p>
        <ul aria-label="Últimas notificações" className="min-h-0 flex-1 overflow-y-auto">
          {itens === null ? <li className="px-4 py-3 text-sm text-tinta-suave">Carregando…</li>
            : itens.length === 0 ? <li className="px-4 py-3 text-sm text-tinta-suave">Nenhuma notificação.</li>
            : itens.map((i) => {
              const conteudo = (
                <>
                  <span className="flex items-start gap-2 font-medium">
                    {!i.lido && <span aria-label="Nova" className="mt-1.5 size-2 shrink-0 rounded-full bg-primaria" />}
                    {i.titulo}
                  </span>
                  <span className="block text-sm text-tinta-suave">{i.detalhe}</span>
                </>
              )
              return (
                <li key={i.id} className="border-b border-linha last:border-b-0">
                  {i.href ? <Link href={i.href} className="block px-4 py-2 hover:bg-superficie-suave">{conteudo}</Link> : <div className="px-4 py-2">{conteudo}</div>}
                </li>
              )
            })}
        </ul>
        <Link href="/avisos" className="border-t border-linha px-4 py-3 text-center text-sm font-semibold text-primaria hover:bg-superficie-suave">Ver todos</Link>
      </div>
    </details>
  )
}
