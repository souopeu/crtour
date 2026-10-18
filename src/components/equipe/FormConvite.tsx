'use client'

import { useActionState, useState } from 'react'
import { convidar } from '@/app/(app)/configuracoes/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import { EQUIPE } from '@/lib/equipe/config'
import type { EstadoForm } from '@/lib/forms'

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

export function FormConvite() {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(convidar, {})
  const [copiado, setCopiado] = useState(false)
  const link = estado.ok ? estado.valores?.link : undefined
  const erro = (n: string) => estado.campos?.[n]?.[0]
  return (
    <div className="flex flex-col gap-3">
      <form key={estado.versao ?? 'inicial'} action={enviar} aria-label="Convidar vendedor(a)" className="flex max-w-md flex-col gap-2">
        <Mensagem estado={estado} />
        <label htmlFor="convite-nome" className="text-sm font-medium">Nome da pessoa</label>
        <input id="convite-nome" name="nome" defaultValue={link ? '' : estado.valores?.nome} maxLength={80} aria-invalid={erro('nome') ? true : undefined} className={campo} />
        {erro('nome') && <p role="alert" className="text-sm text-despesa">{erro('nome')}</p>}
        <label htmlFor="convite-email" className="text-sm font-medium">E-mail da pessoa</label>
        <input id="convite-email" name="email" type="email" defaultValue={link ? '' : estado.valores?.email} aria-invalid={erro('email') ? true : undefined} className={campo} />
        {erro('email') && <p role="alert" className="text-sm text-despesa">{erro('email')}</p>}
        <div><BotaoEnviar>Gerar link de convite</BotaoEnviar></div>
      </form>
      {link && (
        <div className="flex max-w-xl flex-col gap-2 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
          <label htmlFor="convite-link" className="text-sm font-medium">Link do convite</label>
          <input id="convite-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${campo} text-sm`} />
          <button type="button" className="min-h-11 w-fit rounded-full border border-controle px-4 text-sm font-semibold"
            onClick={() => navigator.clipboard?.writeText(link).then(() => setCopiado(true), () => setCopiado(false))}>
            {copiado ? 'Copiado' : 'Copiar link'}
          </button>
          <p className="text-sm text-tinta-suave">
            Envie para a pessoa (por WhatsApp, por exemplo). Vale {EQUIPE.CONVITE_VALIDADE_DIAS} dias, só com esse e-mail, e só aparece agora.
          </p>
        </div>
      )}
    </div>
  )
}
