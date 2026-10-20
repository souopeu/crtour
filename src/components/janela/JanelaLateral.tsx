'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

// R122: "Novo …" opens over the current screen (intercepted route). A native modal <dialog> traps focus,
// makes the page behind inert, closes on Esc and returns focus to the opener. Closing = going back.
// A soft navigation elsewhere (e.g. the redirect after saving) keeps this slot mounted, so the window
// hides itself once the address is no longer the one it opened at (no catch-all route needed).
export function JanelaLateral(props: { titulo: string; children: React.ReactNode }) {
  const caminho = usePathname()
  const [inicial] = useState(caminho)
  return caminho === inicial ? <Dialogo {...props} /> : null
}

function Dialogo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const router = useRouter()
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    return () => d?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onCancel={(ev) => { ev.preventDefault(); router.back() }}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-none overflow-hidden bg-papel p-0 text-tinta shadow-2xl backdrop:bg-black/40 sm:w-[min(48rem,92vw)] sm:rounded-l-2xl"
    >
      <div className="flex h-full flex-col">
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-linha bg-fundo-app px-4 sm:px-6">
          <h1 id={idTitulo} className="text-2xl font-medium tracking-tight">{titulo}</h1>
          <button type="button" onClick={() => router.back()} className="min-h-11 rounded-full border border-linha bg-superficie px-4 text-sm hover:bg-superficie-suave">
            Cancelar
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 sm:px-6">{children}</div>
      </div>
    </dialog>
  )
}
