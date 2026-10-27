'use client'

import { useActionState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

// R162: owner only. Empty = this departure is not sold B2B.
export function PrecoB2bForm({ acao, atual }: { acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>; atual: string }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const v = estado.valores?.preco_b2b ?? atual
  const erro = estado.campos?.preco_b2b?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} aria-label="Preço B2B" className="flex max-w-xl flex-col gap-2">
      <Mensagem estado={estado} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="preco-b2b" className="text-sm font-medium">Preço B2B por pessoa (R$)</label>
          <input id="preco-b2b" name="preco_b2b" defaultValue={v} aria-invalid={erro ? true : undefined} aria-describedby="preco-b2b-dica"
            className="h-12 rounded-xl border border-controle bg-superficie px-3 text-base" />
        </div>
        <BotaoEnviar>Salvar preço B2B</BotaoEnviar>
      </div>
      <p id="preco-b2b-dica" role={erro ? 'alert' : undefined} className={erro ? 'text-sm text-despesa' : 'text-sm text-tinta-suave'}>
        {erro ?? 'Para vender a agências parceiras. Só o dono vê. Deixe em branco para não vender B2B nesta saída.'}
      </p>
    </form>
  )
}
