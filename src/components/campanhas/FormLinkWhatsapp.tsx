'use client'

import { useActionState } from 'react'
import { salvarLinkWhatsapp } from '@/app/(app)/campanhas/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'
type Props = { inicial: { whatsapp: string; mensagem: string; ativo: boolean } }

export function FormLinkWhatsapp({ inicial }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(salvarLinkWhatsapp, {})
  const v = estado.valores ?? { whatsapp: inicial.whatsapp, mensagem: inicial.mensagem, ativo: inicial.ativo ? 'on' : '' }
  const e = (n: string) => estado.campos?.[n]?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} aria-label="Link do WhatsApp para anúncios" className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Mensagem estado={estado} /></div>
      <div className="flex flex-col gap-1">
        <label htmlFor="link-whatsapp" className="text-sm font-medium">WhatsApp da agência</label>
        <input id="link-whatsapp" name="whatsapp" inputMode="tel" defaultValue={v.whatsapp} placeholder="(11) 99999-0000" aria-invalid={e('whatsapp') ? true : undefined} className={campo} />
        {e('whatsapp') && <p role="alert" className="text-sm text-despesa">{e('whatsapp')}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="link-mensagem" className="text-sm font-medium">Mensagem que abre pronta</label>
        <input id="link-mensagem" name="mensagem" maxLength={300} defaultValue={v.mensagem} aria-invalid={e('mensagem') ? true : undefined} className={campo} />
        {e('mensagem') && <p role="alert" className="text-sm text-despesa">{e('mensagem')}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="ativo" defaultChecked={v.ativo === 'on'} className="size-5" /> Link ligado
      </label>
      <div className="sm:col-span-2"><BotaoEnviar>Salvar link</BotaoEnviar></div>
    </form>
  )
}
