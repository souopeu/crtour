'use client'

import Link from 'next/link'
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react'
import { moverNegociacao } from '@/app/(app)/negociacoes/actions'
import { ETAPAS, MOTIVOS, validarMovimento, type Etapa } from '@/lib/negociacoes/negociacoes'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { chip } from '@/components/tela/estilos'
import { COR_ETAPA } from './coresEtapa'

export type CartaoKanban = {
  id: string; titulo: string; clienteId: string; clienteNome: string; etapa: Etapa; valor: number; previsto: number
  probabilidade: number; responsavelNome: string | null; saidaRotulo: string | null; diasNaEtapa: number; parada: boolean
  sugestao?: { para: 'reservado' | 'pago'; texto: string }
}

const select = 'h-11 w-full rounded-lg border border-controle bg-superficie px-2 text-sm'
// R62: column header as a stage-coloured strip ending in an arrow; the text always names the stage.
const SETA = '[clip-path:polygon(0_0,calc(100%-0.75rem)_0,100%_50%,calc(100%-0.75rem)_100%,0_100%)]'

export function KanbanFunil({ cartoes }: { cartoes: CartaoKanban[] }) {
  const [otimistas, mover] = useOptimistic(cartoes, (estado, { id, etapa }: { id: string; etapa: Etapa }) =>
    estado.map((c) => (c.id === id ? { ...c, etapa } : c)))
  const [, iniciar] = useTransition()
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [perda, setPerda] = useState<{ id: string; titulo: string } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [texto, setTexto] = useState('')
  const [erroPerda, setErroPerda] = useState('')
  const dialogo = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dialogo.current
    if (!d) return
    if (perda && !d.open) d.showModal()
    if (!perda && d.open) d.close()
  }, [perda])

  function executar(id: string, etapa: Etapa, m = '', t = '') {
    setMensagem(null)
    iniciar(async () => {
      mover({ id, etapa })
      const r = await moverNegociacao(id, etapa, m, t)
      setMensagem(r.erro ? { tipo: 'erro', texto: r.erro } : { tipo: 'ok', texto: r.ok ?? 'Negociação movida.' })
    })
  }

  function pedirMovimento(id: string, etapa: Etapa) {
    const atual = otimistas.find((c) => c.id === id)
    if (!atual || atual.etapa === etapa) return
    if (etapa === 'perdido') {
      setMotivo(''); setTexto(''); setErroPerda('')
      setPerda({ id, titulo: atual.titulo })
      return
    }
    executar(id, etapa)
  }

  function confirmarPerda(ev: React.FormEvent) {
    ev.preventDefault()
    if (!perda) return
    const r = validarMovimento('perdido', motivo, texto)
    if (!r.ok) { setErroPerda(r.erro); return }
    executar(perda.id, 'perdido', motivo, texto)
    setPerda(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <p role="status" aria-live="polite" className={`min-h-6 text-sm ${mensagem?.tipo === 'erro' ? 'text-despesa' : 'text-receita'}`}>{mensagem?.texto ?? ''}</p>

      <div className="flex gap-4 overflow-x-auto pb-3" role="list" aria-label="Etapas do funil">
        {ETAPAS.map((etapa) => {
          const cards = otimistas.filter((c) => c.etapa === etapa.valor)
          const totalValor = cards.reduce((s, c) => s + c.valor, 0)
          const totalPrevisto = cards.reduce((s, c) => s + c.previsto, 0)
          return (
            <section
              key={etapa.valor}
              role="listitem"
              aria-label={`Etapa ${etapa.rotulo}`}
              data-etapa={etapa.valor}
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={(ev) => { ev.preventDefault(); const id = ev.dataTransfer.getData('text/plain'); if (id) pedirMovimento(id, etapa.valor) }}
              className="flex w-64 shrink-0 flex-col gap-2 rounded-(--radius-cartao) bg-superficie-suave pb-2"
            >
              <header className={`rounded-t-(--radius-cartao) py-2 pl-3 pr-5 text-etapa-texto ${COR_ETAPA[etapa.valor].fundo} ${SETA}`}>
                <h2 className="text-sm font-semibold">{etapa.rotulo} <span className="font-normal">({cards.length})</span></h2>
                <p className="text-xs">Valor {formatarReais(totalValor)} · <strong>previsto {formatarReais(totalPrevisto)}</strong></p>
              </header>
              {cards.length === 0 && <p className="mx-2 rounded-lg border border-dashed border-controle px-2 py-4 text-center text-xs text-tinta-suave">Solte uma negociação aqui.</p>}
              <ul className="flex flex-col gap-2 px-2">
                {cards.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={(ev) => { ev.dataTransfer.setData('text/plain', c.id); ev.dataTransfer.effectAllowed = 'move' }}
                    className="flex cursor-grab flex-col gap-1.5 rounded-lg border border-linha bg-superficie p-2.5 shadow-sm transition-shadow duration-(--duracao-saida) hover:shadow-md active:cursor-grabbing"
                  >
                    <Link href={`/negociacoes/${c.id}`} className="text-sm font-semibold text-primaria underline">{c.titulo}</Link>
                    <Link href={`/clientes/${c.clienteId}`} className={`${chip} w-fit`}>{c.clienteNome}</Link>
                    <p className="text-sm tabular-nums">{formatarReais(c.valor)} · {c.probabilidade}% · <strong>{formatarReais(c.previsto)}</strong></p>
                    {c.saidaRotulo && <p className="text-xs text-tinta-suave">{c.saidaRotulo}</p>}
                    {c.sugestao && c.etapa !== c.sugestao.para && (
                      <div className="flex flex-col gap-1 rounded-lg border border-primaria p-2 text-xs">
                        <p><strong>Sugestão:</strong> {c.sugestao.texto}</p>
                        <button type="button" onClick={() => pedirMovimento(c.id, c.sugestao!.para)} className="min-h-11 w-fit rounded-full bg-destaque px-3 font-semibold text-destaque-texto">
                          Mover para {ETAPAS.find((e) => e.valor === c.sugestao!.para)?.rotulo}
                        </button>
                      </div>
                    )}
                    {c.parada && <p className="text-xs font-semibold text-alerta"><span aria-hidden="true">⏸ </span>Negociação parada</p>}
                    <p className="text-xs text-tinta-suave">{c.responsavelNome ?? 'Sem responsável'} · {c.diasNaEtapa <= 0 ? 'desde hoje' : `há ${c.diasNaEtapa} ${c.diasNaEtapa === 1 ? 'dia' : 'dias'}`} na etapa</p>
                    <label className="text-xs font-medium" htmlFor={`mover-${c.id}`}>Mover para…</label>
                    <select id={`mover-${c.id}`} aria-label={`Mover ${c.titulo} para`} value={c.etapa} onChange={(ev) => pedirMovimento(c.id, ev.target.value as Etapa)} className={select}>
                      {ETAPAS.map((e) => <option key={e.valor} value={e.valor}>{e.rotulo}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      <dialog ref={dialogo} onClose={() => setPerda(null)} aria-labelledby="titulo-perda" className="m-auto w-[min(28rem,92vw)] rounded-[--radius-cartao] border border-linha bg-superficie p-5 text-tinta backdrop:bg-black/40">
        <form onSubmit={confirmarPerda} className="flex flex-col gap-3">
          <h2 id="titulo-perda" className="text-lg font-semibold">Por que perdeu &quot;{perda?.titulo}&quot;?</h2>
          <label htmlFor="motivo-perda" className="text-sm font-medium">Motivo da perda</label>
          <select id="motivo-perda" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} className="h-12 rounded-xl border border-controle bg-superficie px-3 text-base">
            <option value="">Escolha…</option>
            {MOTIVOS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
          </select>
          {motivo === 'outro' && (
            <>
              <label htmlFor="texto-perda" className="text-sm font-medium">Descreva o motivo</label>
              <input id="texto-perda" value={texto} maxLength={200} onChange={(ev) => setTexto(ev.target.value)} className="h-12 rounded-xl border border-controle bg-superficie px-3 text-base" />
            </>
          )}
          {erroPerda && <p role="alert" className="text-sm text-despesa">{erroPerda}</p>}
          <div className="flex gap-3">
            <button type="submit" className="min-h-12 rounded-full bg-despesa px-5 font-semibold text-white">Marcar como perdida</button>
            <button type="button" onClick={() => setPerda(null)} className="min-h-12 px-4 underline">Cancelar</button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
