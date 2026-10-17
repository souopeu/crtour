'use client'

import { useActionState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

type Props = {
  acao: (estado: EstadoForm, fd: FormData) => Promise<EstadoForm>
  inicial: { nome: string; mensagem: string }
  criterios?: string
  rotuloBotao: string
}

export function FormSegmento({ acao, inicial, criterios, rotuloBotao }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const v = estado.valores ?? inicial
  const erroNome = estado.campos?.nome?.[0]
  const erroMensagem = estado.campos?.mensagem?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex max-w-xl flex-col gap-3">
      <Mensagem estado={estado} />
      {criterios !== undefined && <input type="hidden" name="criterios" value={criterios} />}
      <label htmlFor="seg-nome" className="text-sm font-medium">Nome do segmento</label>
      <input id="seg-nome" name="nome" defaultValue={v.nome} maxLength={80}
        aria-invalid={erroNome ? true : undefined} aria-describedby={erroNome ? 'seg-nome-erro' : undefined}
        className="h-12 rounded-xl border border-controle bg-superficie px-3 text-base" />
      {erroNome && <p id="seg-nome-erro" role="alert" className="text-sm text-despesa">{erroNome}</p>}
      <label htmlFor="seg-mensagem" className="text-sm font-medium">Mensagem modelo</label>
      <textarea id="seg-mensagem" name="mensagem" rows={4} defaultValue={v.mensagem} maxLength={1000}
        aria-invalid={erroMensagem ? true : undefined} aria-describedby="seg-mensagem-dica"
        className="rounded-xl border border-controle bg-superficie px-3 py-2 text-base" />
      <p id="seg-mensagem-dica" className="text-sm text-tinta-suave">
        Use {'{nome}'} para o primeiro nome e {'{destino}'} para o destino de interesse. Você confere cada mensagem antes de enviar.
      </p>
      {erroMensagem && <p role="alert" className="text-sm text-despesa">{erroMensagem}</p>}
      <div><BotaoEnviar>{rotuloBotao}</BotaoEnviar></div>
    </form>
  )
}
