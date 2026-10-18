'use client'

import { useEffect } from 'react'
import { marcarConversaLida } from '@/app/(app)/atendimento/actions'

// R104: opening a conversation clears its unread count, once, after the screen shows it.
export function MarcarLida({ id, naoLidas }: { id: string; naoLidas: boolean }) {
  useEffect(() => {
    if (naoLidas) void marcarConversaLida(id)
  }, [id, naoLidas])
  return null
}
