'use client'

import { useActionState } from 'react'
import { salvarConfigMensagens } from '@/app/(app)/hoje/mensagens-actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'
import { MODELOS_PADRAO, TIPOS_MENSAGEM } from '@/lib/mensagens/mensagensPasseio'

type Props = { inicial: Record<string, string> }
const campo = 'rounded-xl border border-controle bg-superficie px-3 text-base'

export function FormMensagensPasseio({ inicial }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(salvarConfigMensagens, {})
  const v = estado.valores ?? inicial
  const erro = (n: string) => estado.campos?.[n]?.[0] && <p role="alert" className="text-sm text-despesa">{estado.campos[n]![0]}</p>
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} aria-label="Mensagens do passeio" className="flex max-w-xl flex-col gap-3">
      <Mensagem estado={estado} />
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="msg-dias-lembrete" className="text-sm font-medium">Lembrete: dias antes da saída</label>
          <input id="msg-dias-lembrete" name="diasLembrete" inputMode="numeric" defaultValue={v.diasLembrete} className={`${campo} h-12 w-24`} />
          {erro('diasLembrete')}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="msg-dias-avaliacao" className="text-sm font-medium">Avaliação: dias depois da saída</label>
          <input id="msg-dias-avaliacao" name="diasAvaliacao" inputMode="numeric" defaultValue={v.diasAvaliacao} className={`${campo} h-12 w-24`} />
          {erro('diasAvaliacao')}
        </div>
      </div>
      {TIPOS_MENSAGEM.map((t) => (
        <div key={t.valor} className="flex flex-col gap-1">
          <label htmlFor={`msg-${t.valor}`} className="text-sm font-medium">Mensagem de {t.rotulo.toLowerCase()}</label>
          <textarea id={`msg-${t.valor}`} name={t.valor} rows={3} maxLength={1000} defaultValue={v[t.valor]} placeholder={MODELOS_PADRAO[t.valor]} className={`${campo} py-2`} />
          {erro(t.valor)}
        </div>
      ))}
      <p className="text-sm text-tinta-suave">Use {'{nome}'}, {'{passeio}'}, {'{data}'} e {'{saldo}'} (no aniversário, só {'{nome}'}). Em branco, vale o texto de exemplo. Quem pediu para não receber mensagens nunca recebe; 1 ano da viagem e aniversário vão só para quem aceitou.</p>
      <div><BotaoEnviar>Salvar mensagens</BotaoEnviar></div>
    </form>
  )
}
