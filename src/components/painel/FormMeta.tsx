'use client'

import { useActionState } from 'react'
import { salvarMeta } from '@/app/(app)/painel/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

export function FormMeta({ mes, rotuloMes, atual }: { mes: string; rotuloMes: string; atual: string }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(salvarMeta.bind(null, mes), {})
  const erro = estado.campos?.valor?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex flex-col gap-2">
      <Mensagem estado={estado} />
      <label htmlFor="meta-valor" className="text-sm font-medium">Meta de {rotuloMes} (R$)</label>
      <div className="flex flex-wrap items-center gap-2">
        <input id="meta-valor" name="valor" inputMode="decimal" defaultValue={estado.valores?.valor ?? atual} placeholder="Ex.: 50.000,00"
          aria-invalid={erro ? true : undefined} aria-describedby="meta-dica"
          className="h-12 w-48 rounded-xl border border-controle bg-superficie px-3 text-base" />
        <BotaoEnviar>Salvar meta</BotaoEnviar>
      </div>
      {erro && <p role="alert" className="text-sm text-despesa">{erro}</p>}
      <p id="meta-dica" className="text-sm text-tinta-suave">Conta só a receita efetiva (vendas que chegaram a Pago no mês). Deixe em branco para remover.</p>
    </form>
  )
}
