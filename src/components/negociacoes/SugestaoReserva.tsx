'use client'

import { useState, useTransition } from 'react'
import { dispensarSugestao, moverNegociacao } from '@/app/(app)/negociacoes/actions'
import { rotuloDaEtapa } from '@/lib/negociacoes/negociacoes'

type Props = { negociacaoId: string; reservaId: string; para: 'reservado' | 'pago'; texto: string }
const botao = 'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold'

// One tap to accept, or "Agora não". Nothing moves on its own.
export function SugestaoReserva({ negociacaoId, reservaId, para, texto }: Props) {
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const agir = (acao: () => Promise<{ erro?: string }>) => iniciar(async () => setErro((await acao()).erro ?? null))
  return (
    <section aria-labelledby="sugestao-titulo" className="flex flex-col gap-2 rounded-[--radius-cartao] border border-primaria bg-superficie p-4">
      <h2 id="sugestao-titulo" className="font-semibold">Sugestão</h2>
      <p>{texto} Mover esta negociação para <strong>{rotuloDaEtapa(para)}</strong>?</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pendente} onClick={() => agir(() => moverNegociacao(negociacaoId, para, '', ''))} className={`${botao} bg-destaque text-destaque-texto`}>
          Mover para {rotuloDaEtapa(para)}
        </button>
        <button type="button" disabled={pendente} onClick={() => agir(() => dispensarSugestao(negociacaoId, reservaId, para))} className={`${botao} border border-controle`}>
          Agora não
        </button>
      </div>
      {erro && <p role="alert" className="text-sm text-despesa">{erro}</p>}
    </section>
  )
}
