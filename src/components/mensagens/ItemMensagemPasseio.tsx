'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { estadoDoBotao, linkWhatsapp } from '@/lib/clientes/whatsappLink'
import type { EstadoForm } from '@/lib/forms'
import { rotuloDaMensagem, type TipoModelo } from '@/lib/mensagens/mensagensPasseio'

type Props = {
  clienteId: string; tipo: TipoModelo; nome: string; whatsapp: string | null; consentimento: string
  contexto: string; mensagem: string; registrar: (mensagem: string) => Promise<EstadoForm>
}
const botao = 'inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold'

// R55/R56: ready message, open WhatsApp, then register. Who asked to leave never gets a button.
export function ItemMensagemPasseio({ clienteId, tipo, nome, whatsapp, consentimento, contexto, mensagem, registrar }: Props) {
  const [abriu, setAbriu] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const estado = estadoDoBotao(whatsapp, consentimento)
  const link = estado.habilitado ? linkWhatsapp(whatsapp, mensagem) : null
  return (
    <li className="flex flex-col gap-2 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
      <p className="text-sm"><strong>{rotuloDaMensagem(tipo)}</strong> · <Link href={`/clientes/${clienteId}`} className="text-primaria underline">{nome}</Link> · {contexto}</p>
      <p className="whitespace-pre-wrap break-words rounded-xl bg-superficie-suave p-2 text-sm">{mensagem}</p>
      <div className="flex flex-wrap items-center gap-2">
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => setAbriu(true)} aria-label={`Enviar ${rotuloDaMensagem(tipo).toLowerCase()} para ${nome} no WhatsApp`} className={`${botao} bg-destaque text-destaque-texto`}>WhatsApp</a>
        ) : (
          <span className="text-sm text-tinta-suave">{!estado.habilitado && estado.motivo === 'pediu_saida' ? 'Pediu para não receber mensagens: não enviar.' : 'Sem WhatsApp cadastrado.'}</span>
        )}
        {link && estado.habilitado && estado.aviso === 'sem_consentimento' && <span className="text-xs text-alerta">Consentimento não informado (mensagem de serviço)</span>}
        {abriu && (
          <button type="button" disabled={pendente} className={`${botao} border border-controle bg-superficie`}
            onClick={() => iniciar(async () => { const r = await registrar(mensagem); setErro(r.erro ?? null) })}>
            {pendente ? 'Registrando…' : 'Registrar envio'}
          </button>
        )}
        {erro && <span role="alert" className="text-sm text-despesa">{erro}</span>}
      </div>
    </li>
  )
}
