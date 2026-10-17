'use client'

import { useActionState } from 'react'
import { salvarRegra } from '@/app/(app)/comissoes/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import { REGRAS, type Regra } from '@/lib/comissao/comissao'
import type { EstadoForm } from '@/lib/forms'

export function FormRegra({ regra }: { regra: Regra | null }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(salvarRegra, {})
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex max-w-xl flex-col gap-2">
      <Mensagem estado={estado} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Regra da comissão</legend>
        {[{ valor: '', rotulo: 'Não usar comissão', explicacao: '' }, ...REGRAS].map((r) => (
          <label key={r.valor} className="flex min-h-11 items-start gap-3">
            <input type="radio" name="regra" value={r.valor} defaultChecked={(regra ?? '') === r.valor} className="mt-1 size-5" />
            <span><span className="font-medium">{r.rotulo}</span>{r.explicacao && <span className="block text-sm text-tinta-suave">{r.explicacao}</span>}</span>
          </label>
        ))}
      </fieldset>
      <div><BotaoEnviar>Salvar regra</BotaoEnviar></div>
    </form>
  )
}
