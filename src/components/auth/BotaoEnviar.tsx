'use client'

import { useFormStatus } from 'react-dom'

export function BotaoEnviar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 rounded-full bg-destaque px-6 font-semibold text-destaque-texto disabled:opacity-60"
    >
      {pending ? 'Aguarde…' : children}
    </button>
  )
}
