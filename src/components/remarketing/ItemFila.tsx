'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { registrarEnvio } from '@/app/(app)/remarketing/actions'
import { linkWhatsapp } from '@/lib/clientes/whatsappLink'
import { chip } from '@/components/tela/estilos'

type Props = { segmentoId: string; clienteId: string; nome: string; whatsapp: string; destino: string | null; mensagem: string }
const botao = 'inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-semibold'

// One person at a time: open WhatsApp with the message, send it there, then register here.
// R127: a table row — client chip, destination, the message on one line (opens in full) and the action last.
export function ItemFila({ segmentoId, clienteId, nome, whatsapp, destino, mensagem }: Props) {
  const [abriu, setAbriu] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const link = linkWhatsapp(whatsapp, mensagem)
  return (
    <tr className="align-top">
      <td className="py-2"><Link href={`/clientes/${clienteId}`} className={chip}>{nome}</Link></td>
      <td className="py-2">{destino ?? '—'}</td>
      <td className="max-w-md py-2">
        <details>
          <summary className="cursor-pointer list-none truncate text-tinta-suave hover:text-tinta" title="Ver a mensagem inteira">{mensagem}</summary>
          <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-superficie-suave p-2">{mensagem}</p>
        </details>
      </td>
      <td className="py-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
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
          {erro && <span role="alert" className="text-despesa">{erro}</span>}
        </div>
      </td>
    </tr>
  )
}
