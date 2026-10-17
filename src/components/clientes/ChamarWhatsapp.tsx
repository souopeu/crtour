'use client'

import { useState } from 'react'
import { TAMANHO_MAXIMO_MENSAGEM, estadoDoBotao, linkWhatsapp, mensagemPadrao } from '@/lib/clientes/whatsappLink'

type Props = { nome: string; whatsapp: string | null; consentimento: string }

const MOTIVOS = {
  sem_numero: 'Cadastre o WhatsApp do cliente para chamar por aqui.',
  pediu_saida: 'Este cliente pediu para não receber mensagens. Não envie mensagens.',
} as const

const botao = 'inline-flex min-h-12 items-center justify-center rounded-full px-6 font-semibold'

export function ChamarWhatsapp({ nome, whatsapp, consentimento }: Props) {
  const [mensagem, setMensagem] = useState(() => mensagemPadrao(nome))
  const estado = estadoDoBotao(whatsapp, consentimento)
  const link = estado.habilitado ? linkWhatsapp(whatsapp, mensagem) : null

  return (
    <section aria-labelledby="whatsapp-titulo" className="flex max-w-xl flex-col gap-2">
      <h2 id="whatsapp-titulo" className="text-lg font-semibold">WhatsApp</h2>

      {!estado.habilitado || !link ? (
        <>
          <button type="button" disabled aria-describedby="whatsapp-motivo" className={`${botao} w-fit bg-superficie-suave text-tinta-suave`}>
            Chamar no WhatsApp
          </button>
          <p id="whatsapp-motivo" className="text-sm text-despesa">
            {estado.habilitado ? MOTIVOS.sem_numero : MOTIVOS[estado.motivo]}
          </p>
        </>
      ) : (
        <>
          <label htmlFor="mensagem-whatsapp" className="text-sm font-medium">Mensagem</label>
          <textarea
            id="mensagem-whatsapp" rows={3} value={mensagem} maxLength={TAMANHO_MAXIMO_MENSAGEM}
            onChange={(e) => setMensagem(e.target.value)}
            className="rounded-xl border border-controle bg-superficie px-3 py-2 text-base"
          />
          <a href={link} target="_blank" rel="noopener noreferrer" className={`${botao} w-fit bg-destaque text-destaque-texto`}>
            Chamar no WhatsApp
          </a>
          <p className="text-sm text-tinta-suave">
            O WhatsApp abre com a mensagem pronta; você confere e envia.
          </p>
          {estado.aviso === 'sem_consentimento' && (
            <p role="note" className="rounded-xl bg-alerta-suave p-3 text-sm text-alerta">
              Consentimento não informado: use só para responder quem já falou com a agência, não para promoções.
            </p>
          )}
        </>
      )}
    </section>
  )
}
