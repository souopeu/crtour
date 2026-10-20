'use client'

import { useEffect, useState, useTransition } from 'react'
import { apagarInscricaoPush, salvarInscricaoPush } from '@/app/(app)/configuracoes/push-actions'

type Estado = 'carregando' | 'sem_suporte' | 'sem_chave' | 'bloqueado' | 'ligado' | 'desligado'
const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

// base64url (VAPID public key) → bytes, as pushManager.subscribe expects.
function paraBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const bruto = atob(b64)
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length))
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i)
  return bytes
}

// What this device can do right now (support, configuration, permission, current subscription).
async function verificarAparelho(): Promise<Estado> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'sem_suporte'
  if (!CHAVE_PUBLICA) return 'sem_chave'
  if (Notification.permission === 'denied') return 'bloqueado'
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    return (await reg.pushManager.getSubscription()) ? 'ligado' : 'desligado'
  } catch {
    return 'sem_suporte'
  }
}

const botao = 'inline-flex min-h-11 w-fit items-center rounded-full px-5 text-sm font-semibold'

// R131: each person turns notices on or off for this device. The bell keeps working either way.
export function AvisosNoAparelho() {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  useEffect(() => {
    let vivo = true
    verificarAparelho().then((e) => { if (vivo) setEstado(e) })
    return () => { vivo = false }
  }, [])

  const ligar = () => iniciar(async () => {
    setErro(null)
    try {
      if ((await Notification.requestPermission()) !== 'granted') { setEstado('bloqueado'); return }
      const reg = await navigator.serviceWorker.register('/sw.js')
      const inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(CHAVE_PUBLICA) })
      const r = await salvarInscricaoPush(inscricao.toJSON())
      if (!r.ok) { await inscricao.unsubscribe(); setErro('Não foi possível ligar os avisos. Tente de novo.'); return }
      setEstado('ligado')
    } catch {
      setErro('Não foi possível ligar os avisos neste aparelho.')
    }
  })

  const desligar = () => iniciar(async () => {
    setErro(null)
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const inscricao = await reg?.pushManager.getSubscription()
    if (inscricao) { await apagarInscricaoPush(inscricao.endpoint); await inscricao.unsubscribe() }
    setEstado('desligado')
  })

  return (
    <div className="flex flex-col gap-2">
      <p className="max-w-prose text-sm">
        Receba no celular ou no computador os lembretes de atividade, cobrança e saída, mesmo com o crTOUR fechado.
        Vale só para este aparelho; o sino continua funcionando sempre.
      </p>
      {estado === 'carregando' && <p className="text-sm text-tinta-suave">Verificando este aparelho…</p>}
      {estado === 'sem_suporte' && <p className="text-sm text-tinta-suave">Este navegador não recebe avisos. No iPhone, instale o crTOUR na tela inicial (Compartilhar → Adicionar à Tela de Início) e abra por lá.</p>}
      {estado === 'sem_chave' && <p className="text-sm text-tinta-suave">Os avisos no aparelho ainda não foram ativados nesta instalação do crTOUR.</p>}
      {estado === 'bloqueado' && <p className="text-sm text-tinta-suave">As notificações estão bloqueadas para o crTOUR neste navegador. Libere nas configurações do navegador e volte aqui.</p>}
      {estado === 'desligado' && <button type="button" onClick={ligar} disabled={pendente} className={`${botao} bg-marca text-white`}>{pendente ? 'Ligando…' : 'Receber avisos neste aparelho'}</button>}
      {estado === 'ligado' && (
        <>
          <p className="text-sm font-semibold text-receita">✓ Este aparelho recebe avisos.</p>
          <button type="button" onClick={desligar} disabled={pendente} className={`${botao} border border-controle bg-superficie`}>{pendente ? 'Desligando…' : 'Parar de receber neste aparelho'}</button>
        </>
      )}
      {erro && <p role="alert" className="text-sm text-despesa">{erro}</p>}
    </div>
  )
}
