'use client'

import { useActionState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'
import type { Pergunta } from '@/lib/perguntas/perguntas'
import { CamposRespostas } from './CamposRespostas'

type Props = {
  acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>
  perguntas: Pergunta[]
  pessoas: number
  respostas: Record<string, string>
  nomes: string[]
  editavel: boolean
}

export function RespostasDaReserva({ acao, perguntas, pessoas, respostas, nomes, editavel }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const valores = estado.valores ?? respostas
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} aria-label="Respostas" className="flex max-w-xl flex-col gap-3">
      <Mensagem estado={estado} />
      <fieldset disabled={!editavel} className="contents">
        <CamposRespostas perguntas={perguntas} pessoas={pessoas} valores={valores} erros={estado.campos} nomes={nomes} />
      </fieldset>
      {editavel && <div><BotaoEnviar>Salvar respostas</BotaoEnviar></div>}
    </form>
  )
}
