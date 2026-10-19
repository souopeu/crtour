'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ATENDIMENTO } from '@/lib/atendimento/config'

// R106: new messages show up without reloading. Refreshes the server data every few seconds while the tab is visible,
// and right away when the person comes back to the tab. What is being typed stays (client state survives a refresh).
export function AtualizarSozinho() {
  const router = useRouter()
  useEffect(() => {
    const atualizar = () => { if (document.visibilityState === 'visible') router.refresh() }
    const intervalo = window.setInterval(atualizar, ATENDIMENTO.ATUALIZAR_MS)
    document.addEventListener('visibilitychange', atualizar)
    return () => { window.clearInterval(intervalo); document.removeEventListener('visibilitychange', atualizar) }
  }, [router])
  return null
}
