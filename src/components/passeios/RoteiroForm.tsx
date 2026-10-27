'use client'

import { useActionState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

type Props = { acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>; dias: number; roteiro: { dia: number; titulo: string; descricao: string | null }[] }
const campo = 'rounded-xl border border-controle bg-superficie px-3 text-base'

// R164: one block per day of the excursion; a day left blank is removed.
export function RoteiroForm({ acao, dias, roteiro }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const salvo = Object.fromEntries(roteiro.flatMap((d) => [[`titulo_${d.dia}`, d.titulo], [`descricao_${d.dia}`, d.descricao ?? '']]))
  const v = estado.valores ?? salvo
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} aria-label="Roteiro" className="flex max-w-xl flex-col gap-4">
      <Mensagem estado={estado} />
      {Array.from({ length: dias }, (_, i) => i + 1).map((dia) => {
        const erro = estado.campos?.[`titulo_${dia}`]?.[0]
        return (
          <fieldset key={dia} className="flex flex-col gap-2 rounded-[--radius-cartao] border border-linha p-3">
            <legend className="px-1 font-semibold">Dia {dia}</legend>
            <label htmlFor={`roteiro-titulo-${dia}`} className="text-sm font-medium">Título do dia {dia}</label>
            <input id={`roteiro-titulo-${dia}`} name={`titulo_${dia}`} defaultValue={v[`titulo_${dia}`] ?? ''} maxLength={120} placeholder="Ex.: Gramado"
              aria-invalid={erro ? true : undefined} aria-describedby={erro ? `roteiro-erro-${dia}` : undefined} className={`${campo} h-12`} />
            {erro && <p id={`roteiro-erro-${dia}`} role="alert" className="text-sm text-despesa">{erro}</p>}
            <label htmlFor={`roteiro-descricao-${dia}`} className="text-sm font-medium">O que acontece no dia {dia}</label>
            <textarea id={`roteiro-descricao-${dia}`} name={`descricao_${dia}`} defaultValue={v[`descricao_${dia}`] ?? ''} rows={2} maxLength={2000} className={`${campo} py-2`} />
          </fieldset>
        )
      })}
      <div><BotaoEnviar>Salvar roteiro</BotaoEnviar></div>
    </form>
  )
}
