'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { registrarEnvio } from '@/app/(app)/remarketing/actions'
import { linkWhatsapp } from '@/lib/clientes/whatsappLink'

type Props = { segmentoId: string; clienteId: string; nome: string; whatsapp: string; destino: string | null; mensagem: string }
const botao = 'inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold'

// One person at a time: open WhatsApp with the message, send it there, then register here.
export function ItemFila({ segmentoId, clienteId, nome, whatsapp, destino, mensagem }: Props) {
  const [abriu, setAbriu] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const link = linkWhatsapp(whatsapp, mensagem)
  return (
    <li className="flex flex-col gap-2 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
      <p><Link href={`/clientes/${clienteId}`} className="font-semibold text-primaria underline">{nome}</Link>{destino && <span className="text-sm text-tinta-suave"> · {destino}</span>}</p>
      <p className="whitespace-pre-wrap break-words rounded-xl bg-superficie-suave p-2 text-sm">{mensagem}</p>
      <div className="flex flex-wrap items-center gap-2">
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => setAbriu(true)} aria-label={`Chamar ${nome} no WhatsApp`} className={`${botao} bg-destaque text-destaque-texto`}>
            WhatsApp
          </a>
        )}
        {abriu && (
          <button type="button" disabled={pendente} className={`${botao} border border-controle bg-superficie`}
            onClick={() => iniciar(async () => { const r = await registrarEnvio(segmentoId, clienteId, mensagem); setErro(r.erro ?? null) })}>
            {pendente ? 'Registrando…' : 'Registrar envio'}
          </button>
        )}
        {erro && <span role="alert" className="text-sm text-despesa">{erro}</span>}
      </div>
    </li>
  )
}
