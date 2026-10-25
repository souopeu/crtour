'use client'

import { useActionState, useId } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'
import { CATEGORIAS_VEICULO, rotuloCategoria } from '@/lib/veiculos/veiculos'

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'
type Valores = { nome?: string; categoria?: string; lugares?: string }

// R137: the same form creates (empty) and edits (with `inicial`) a vehicle.
export function FormVeiculo({ acao, inicial = {}, rotuloBotao }: {
  acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>; inicial?: Valores; rotuloBotao: string
}) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const id = useId() // fixed ids would clash with the page Next keeps behind (see Campo)
  const v: Valores = estado.valores ?? inicial
  const erro = (n: string) => estado.campos?.[n]?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} aria-label={rotuloBotao} className="grid gap-3 rounded-(--radius-cartao) border border-linha bg-superficie p-4 sm:grid-cols-3">
      <div className="sm:col-span-3"><Mensagem estado={estado} /></div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-nome`} className="text-sm font-medium">Nome</label>
        <input id={`${id}-nome`} name="nome" defaultValue={v.nome} maxLength={80} placeholder="Ex.: Van 01" aria-invalid={erro('nome') ? true : undefined} className={campo} />
        {erro('nome') && <p role="alert" className="text-sm text-despesa">{erro('nome')}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-categoria`} className="text-sm font-medium">Tipo</label>
        <select id={`${id}-categoria`} name="categoria" defaultValue={v.categoria ?? 'van'} className={campo}>
          {CATEGORIAS_VEICULO.map((c) => <option key={c} value={c}>{rotuloCategoria(c)}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-lugares`} className="text-sm font-medium">Lugares</label>
        <input id={`${id}-lugares`} name="lugares" type="number" inputMode="numeric" defaultValue={v.lugares}
          aria-invalid={erro('lugares') ? true : undefined} className={campo} />
        {erro('lugares') && <p role="alert" className="text-sm text-despesa">{erro('lugares')}</p>}
      </div>
      <div className="sm:col-span-3"><BotaoEnviar>{rotuloBotao}</BotaoEnviar></div>
    </form>
  )
}
