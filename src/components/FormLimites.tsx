'use client'

import { useActionState } from 'react'
import { salvarLimites } from '@/app/(app)/configuracoes/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

const CAMPOS = [
  { nome: 'diasSemContato', rotulo: 'Cliente sem contato depois de (dias)' },
  { nome: 'diasParada', rotulo: 'Negociação parada depois de (dias na mesma etapa)' },
] as const

export function FormLimites({ diasSemContato, diasParada }: { diasSemContato: number; diasParada: number }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(salvarLimites, {})
  const inicial = { diasSemContato: String(diasSemContato), diasParada: String(diasParada) }
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex max-w-md flex-col gap-3">
      <Mensagem estado={estado} />
      {CAMPOS.map((c) => {
        const erro = estado.campos?.[c.nome]?.[0]
        return (
          <div key={c.nome} className="flex flex-col gap-1">
            <label htmlFor={c.nome} className="text-sm font-medium">{c.rotulo}</label>
            <input id={c.nome} name={c.nome} inputMode="numeric" defaultValue={estado.valores?.[c.nome] ?? inicial[c.nome]}
              aria-invalid={erro ? true : undefined} aria-describedby={erro ? `${c.nome}-erro` : undefined}
              className="h-12 w-32 rounded-xl border border-controle bg-superficie px-3 text-base" />
            {erro && <p id={`${c.nome}-erro`} role="alert" className="text-sm text-despesa">{erro}</p>}
          </div>
        )
      })}
      <div><BotaoEnviar>Salvar prazos</BotaoEnviar></div>
    </form>
  )
}
