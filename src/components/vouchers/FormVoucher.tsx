'use client'

import { useActionState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

type Props = { acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm> }
const campo = 'h-11 rounded-lg border border-controle bg-superficie px-3 text-sm'

function Campo({ id, rotulo, erro, children }: { id: string; rotulo: string; erro?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
      {children}
      {erro && <p role="alert" className="text-sm text-despesa">{erro}</p>}
    </div>
  )
}

export function FormVoucher({ acao }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const e = (n: string) => estado.campos?.[n]?.[0]
  const v = estado.valores ?? {}
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} aria-label="Novo voucher" className="flex flex-col gap-3">
      <Mensagem estado={estado} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Campo id="vou-encontro" rotulo="Ponto de encontro (opcional)" erro={e('encontro')}>
            <input id="vou-encontro" name="encontro" defaultValue={v.encontro ?? ''} maxLength={200} aria-invalid={e('encontro') ? true : undefined} className={campo} />
          </Campo>
        </div>
        <Campo id="vou-horario" rotulo="Horário (opcional)" erro={e('horario')}>
          <input id="vou-horario" name="horario" type="time" defaultValue={v.horario ?? ''} aria-invalid={e('horario') ? true : undefined} className={campo} />
        </Campo>
      </div>
      <Campo id="vou-observacoes" rotulo="Observações (opcional)" erro={e('observacoes')}>
        <textarea id="vou-observacoes" name="observacoes" defaultValue={v.observacoes ?? ''} maxLength={1000} rows={2} className="rounded-lg border border-controle bg-superficie px-3 py-2 text-sm" />
      </Campo>
      <div><BotaoEnviar>Criar voucher</BotaoEnviar></div>
    </form>
  )
}
