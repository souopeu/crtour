'use client'

import { useActionState } from 'react'
import { salvarFormulario } from '@/app/(app)/configuracoes/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

const campo = 'rounded-xl border border-controle bg-superficie px-3 text-base'

export function FormFormularioCaptacao({ inicial }: { inicial: { titulo: string; texto: string; ativo: boolean } }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(salvarFormulario, {})
  const v = estado.valores ?? { titulo: inicial.titulo, texto: inicial.texto, ativo: inicial.ativo ? 'on' : '' }
  const erro = (n: string) => estado.campos?.[n]?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex flex-col gap-3">
      <Mensagem estado={estado} />
      <label className="flex items-center gap-3 font-medium">
        <input type="checkbox" name="ativo" defaultChecked={v.ativo === 'on'} className="size-5" />
        Formulário ligado
      </label>
      <div className="flex flex-col gap-1">
        <label htmlFor="form-titulo" className="text-sm font-medium">Título</label>
        <input id="form-titulo" name="titulo" defaultValue={v.titulo} maxLength={120} aria-invalid={erro('titulo') ? true : undefined} className={`${campo} h-12`} />
        {erro('titulo') && <p role="alert" className="text-sm text-despesa">{erro('titulo')}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="form-texto" className="text-sm font-medium">Texto de apresentação</label>
        <textarea id="form-texto" name="texto" defaultValue={v.texto} maxLength={1000} rows={3} className={`${campo} py-2`} />
        {erro('texto') && <p role="alert" className="text-sm text-despesa">{erro('texto')}</p>}
      </div>
      <div><BotaoEnviar>Salvar formulário</BotaoEnviar></div>
    </form>
  )
}
