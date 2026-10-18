'use client'

import { useActionState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

type Valores = { pessoas: string; total: string; sinal: string; sinalAte: string; saldoAte: string; validade: string; observacoes: string }
type Props = { acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>; inicial: Valores }
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

export function FormProposta({ acao, inicial }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const v = (estado.valores as Valores | undefined) ?? inicial
  const e = (n: string) => estado.campos?.[n]?.[0]
  const entrada = (n: keyof Valores, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={`prop-${n}`} name={n} defaultValue={v[n]} aria-invalid={e(n) ? true : undefined} className={campo} {...extra} />
  )
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} aria-label="Nova proposta" className="flex flex-col gap-3">
      <Mensagem estado={estado} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo id="prop-pessoas" rotulo="Pessoas" erro={e('pessoas')}>{entrada('pessoas', { inputMode: 'numeric' })}</Campo>
        <Campo id="prop-total" rotulo="Valor total (R$)" erro={e('total')}>{entrada('total', { inputMode: 'decimal', placeholder: '9.000,00' })}</Campo>
        <Campo id="prop-validade" rotulo="Válida até" erro={e('validade')}>{entrada('validade', { type: 'date' })}</Campo>
        <Campo id="prop-sinal" rotulo="Sinal (R$)" erro={e('sinal')}>{entrada('sinal', { inputMode: 'decimal', placeholder: 'Opcional' })}</Campo>
        <Campo id="prop-sinalAte" rotulo="Sinal até" erro={e('sinalAte')}>{entrada('sinalAte', { type: 'date' })}</Campo>
        <Campo id="prop-saldoAte" rotulo="Saldo até" erro={e('saldoAte')}>{entrada('saldoAte', { type: 'date' })}</Campo>
      </div>
      <Campo id="prop-observacoes" rotulo="Observações (opcional)" erro={e('observacoes')}>
        <textarea id="prop-observacoes" name="observacoes" defaultValue={v.observacoes} maxLength={1000} rows={2} className="rounded-lg border border-controle bg-superficie px-3 py-2 text-sm" />
      </Campo>
      <div><BotaoEnviar>Criar proposta</BotaoEnviar></div>
    </form>
  )
}
