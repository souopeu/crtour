'use client'

import { useActionState } from 'react'
import { enviarMensagem } from '@/app/(app)/atendimento/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

// R105: reply box. When sending is not allowed the reason is shown and the field is off (the server checks again).
export function CampoResposta({ id, bloqueio }: { id: string; bloqueio: string | null }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(enviarMensagem.bind(null, id), {})
  const erro = estado.campos?.texto?.[0]
  if (bloqueio) return <p role="note" className="border-t border-linha pt-3 text-sm text-tinta-suave">{bloqueio}</p>
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex flex-col gap-2 border-t border-linha pt-3">
      <Mensagem estado={{ erro: estado.erro, ok: estado.ok }} />
      <label htmlFor={`resposta-${id}`} className="text-sm font-medium">Responder</label>
      <textarea id={`resposta-${id}`} name="texto" rows={3} maxLength={4096} defaultValue={estado.ok ? '' : estado.valores?.texto ?? ''}
        aria-invalid={erro ? true : undefined} aria-describedby={erro ? `resposta-${id}-erro` : undefined}
        className="min-h-24 w-full rounded-xl border border-controle bg-superficie p-3 text-base" />
      {erro && <p id={`resposta-${id}-erro`} role="alert" className="text-sm text-despesa">{erro}</p>}
      <div className="flex justify-end"><BotaoEnviar>Enviar</BotaoEnviar></div>
    </form>
  )
}
