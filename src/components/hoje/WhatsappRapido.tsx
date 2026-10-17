'use client'

import { useState, useTransition } from 'react'
import { registrarWhatsapp } from '@/app/(app)/atividades/actions'
import { estadoDoBotao, linkWhatsapp, mensagemPadrao } from '@/lib/clientes/whatsappLink'

type Props = { clienteId: string; nome: string; whatsapp: string | null; consentimento: string; registrar?: boolean }

const MOTIVO = { sem_numero: 'Sem WhatsApp cadastrado.', pediu_saida: 'Pediu para não receber mensagens.' } as const
const botao = 'inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold'

// Compact WhatsApp for lists: same consent rules as the client sheet; optional one-tap "Registrar como feito".
export function WhatsappRapido({ clienteId, nome, whatsapp, consentimento, registrar = false }: Props) {
  const [abriu, setAbriu] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const estado = estadoDoBotao(whatsapp, consentimento)
  const mensagem = mensagemPadrao(nome)
  const link = estado.habilitado ? linkWhatsapp(whatsapp, mensagem) : null

  if (!estado.habilitado || !link) {
    return <span className="text-sm text-tinta-suave">{estado.habilitado ? MOTIVO.sem_numero : MOTIVO[estado.motivo]}</span>
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => setAbriu(true)} aria-label={`Chamar ${nome} no WhatsApp`}
        className={`${botao} bg-destaque text-destaque-texto`}>
        WhatsApp
      </a>
      {estado.aviso === 'sem_consentimento' && <span className="text-xs text-alerta">Consentimento não informado</span>}
      {registrar && abriu && (
        <button type="button" disabled={pendente} className={`${botao} border border-controle bg-superficie`}
          onClick={() => iniciar(async () => { const r = await registrarWhatsapp(clienteId, mensagem); setErro(r.erro ?? null) })}>
          {pendente ? 'Registrando…' : 'Registrar como feito'}
        </button>
      )}
      {erro && <span role="alert" className="text-sm text-despesa">{erro}</span>}
    </span>
  )
}
