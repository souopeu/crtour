'use client'

import { useState, useTransition } from 'react'
import { registrarWhatsapp } from '@/app/(app)/atividades/actions'
import { TAMANHO_MAXIMO_MENSAGEM, estadoDoBotao, linkWhatsapp, mensagemPadrao } from '@/lib/clientes/whatsappLink'

type Props = { clienteId: string; nome: string; whatsapp: string | null; consentimento: string }

const MOTIVOS = {
  sem_numero: 'Cadastre o WhatsApp do cliente para chamar por aqui.',
  pediu_saida: 'Este cliente pediu para não receber mensagens. Não envie mensagens.',
} as const

const botao = 'inline-flex min-h-12 items-center justify-center rounded-full px-6 font-semibold'

export function ChamarWhatsapp({ clienteId, nome, whatsapp, consentimento }: Props) {
  const [mensagem, setMensagem] = useState(() => mensagemPadrao(nome))
  const [abriu, setAbriu] = useState(false)
  const [registro, setRegistro] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendente, iniciar] = useTransition()

  function registrar() {
    iniciar(async () => {
      const r = await registrarWhatsapp(clienteId, mensagem)
      setRegistro(r.erro ? { ok: false, texto: r.erro } : { ok: true, texto: r.ok ?? 'Registrado.' })
    })
  }
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
          <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => { setAbriu(true); setRegistro(null) }} className={`${botao} w-fit bg-destaque text-destaque-texto`}>
            Chamar no WhatsApp
          </a>
          {abriu && !registro?.ok && (
            <button type="button" onClick={registrar} disabled={pendente} className={`${botao} w-fit border border-controle bg-superficie`}>
              {pendente ? 'Registrando…' : 'Registrar como feito'}
            </button>
          )}
          <p role="status" aria-live="polite" className={`text-sm ${registro?.ok === false ? 'text-despesa' : 'text-receita'}`}>{registro?.texto ?? ''}</p>
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
