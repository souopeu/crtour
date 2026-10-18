'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { enviarFormulario } from '@/app/f/[codigo]/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import { FORMULARIO } from '@/lib/formulario/config'
import type { EstadoForm } from '@/lib/forms'

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'
function Campo({ id, rotulo, erro, children }: { id: string; rotulo: string; erro?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
      {children}
      {erro && <p role="alert" className="text-sm text-despesa">{erro}</p>}
    </div>
  )
}

type Props = { codigo: string; origem: { o: string; utm_source: string; utm_campaign: string } }

export function FormPublico({ codigo, origem }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(enviarFormulario, {})
  if (estado.ok) return <p role="status" className="rounded-xl bg-receita-suave p-4 font-medium text-receita">{estado.ok}</p>
  const v = estado.valores ?? {}
  const erro = (n: string) => estado.campos?.[n]?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} noValidate className="flex flex-col gap-4">
      <Mensagem estado={estado} />
      <input type="hidden" name="codigo" value={codigo} />
      {Object.entries(origem).map(([k, valor]) => <input key={k} type="hidden" name={k} value={valor} />)}
      {/* R68: bait field, invisible to people and to screen readers; robots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={FORMULARIO.CAMPO_ISCA}>Não preencha</label>
        <input id={FORMULARIO.CAMPO_ISCA} name={FORMULARIO.CAMPO_ISCA} tabIndex={-1} autoComplete="off" />
      </div>
      <Campo id="nome" erro={erro('nome')} rotulo="Seu nome"><input id="nome" name="nome" defaultValue={v.nome} maxLength={FORMULARIO.NOME_MAX} autoComplete="name" aria-invalid={erro('nome') ? true : undefined} className={campo} /></Campo>
      <Campo id="whatsapp" erro={erro('whatsapp')} rotulo="WhatsApp"><input id="whatsapp" name="whatsapp" defaultValue={v.whatsapp} inputMode="tel" autoComplete="tel" placeholder="(11) 99999-0000" aria-invalid={erro('whatsapp') ? true : undefined} className={campo} /></Campo>
      <Campo id="destino" erro={erro('destino')} rotulo="Para onde quer viajar (opcional)"><input id="destino" name="destino" defaultValue={v.destino} maxLength={FORMULARIO.DESTINO_MAX} className={campo} /></Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="pessoas" erro={erro('pessoas')} rotulo="Quantas pessoas (opcional)"><input id="pessoas" name="pessoas" defaultValue={v.pessoas} inputMode="numeric" className={campo} /></Campo>
        <Campo id="data" erro={erro('data')} rotulo="Quando pensa em ir (opcional)"><input id="data" name="data" type="date" defaultValue={v.data} className={campo} /></Campo>
      </div>
      <Campo id="mensagem" erro={erro('mensagem')} rotulo="Mensagem (opcional)"><textarea id="mensagem" name="mensagem" defaultValue={v.mensagem} maxLength={FORMULARIO.MENSAGEM_MAX} rows={3} className="rounded-xl border border-controle bg-superficie px-3 py-2 text-base" /></Campo>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="aceita" className="mt-1 size-5" />
        <span>Aceito receber mensagens da agência pelo WhatsApp sobre viagens e ofertas. Posso pedir para sair quando quiser.</span>
      </label>
      <p className="text-xs text-tinta-suave">Seus dados vão só para esta agência. Veja a <Link href="/privacidade" className="underline">política de privacidade</Link>.</p>
      <BotaoEnviar>Enviar</BotaoEnviar>
    </form>
  )
}
