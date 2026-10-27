'use client'

import { useActionState, useState } from 'react'
import { criarReserva } from '@/app/(app)/saidas/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import { COBRANCAS, campoDoExtra, quantidadeSugerida, totalComExtras, type Cobranca } from '@/lib/extras/extras'
import type { EstadoForm } from '@/lib/forms'
import { formatarReais, reaisParaCentavos } from '@/lib/passeios/dinheiro'

type ExtraVenda = { id: string; nome: string; preco_centavos: number; cobranca: Cobranca }
type Props = { saidaId: string; clienteId: string; vagasLivres: number; precoCentavos: number; extras: ExtraVenda[] }

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

function Dica({ id, erro, children }: { id: string; erro?: string; children: React.ReactNode }) {
  return <p id={id} role={erro ? 'alert' : undefined} className={erro ? 'text-sm text-despesa' : 'text-sm text-tinta-suave'}>{erro ?? children}</p>
}

// R158: extras with a quantity each; the total below follows what is typed (tour value + extras).
function Campos({ v, estado, vagasLivres, precoCentavos, extras }: { v: Record<string, string>; estado: EstadoForm } & Omit<Props, 'saidaId' | 'clienteId'>) {
  const [qtd, setQtd] = useState(v.qtd)
  const [valor, setValor] = useState(v.valor)
  const [itens, setItens] = useState<Record<string, string>>(Object.fromEntries(extras.map((e) => [e.id, v[campoDoExtra(e.id)] ?? ''])))
  const pessoas = /^\d+$/.test(qtd) ? Number(qtd) : 0
  const base = valor.trim() === '' ? pessoas * precoCentavos : (reaisParaCentavos(valor) ?? 0)
  const vendidos = extras.map((e) => ({ ...e, quantidade: /^\d+$/.test(itens[e.id]) ? Number(itens[e.id]) : 0 })).filter((e) => e.quantidade > 0)
  const erro = (n: string) => estado.campos?.[n]?.[0]

  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor="reserva-qtd" className="text-sm font-medium">Número de pessoas</label>
        <input id="reserva-qtd" name="qtd" type="number" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value)}
          aria-invalid={erro('qtd') ? true : undefined} aria-describedby="reserva-qtd-dica" className={campo} />
        <Dica id="reserva-qtd-dica" erro={erro('qtd')}>Restam {vagasLivres} {vagasLivres === 1 ? 'vaga' : 'vagas'}.</Dica>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="reserva-valor" className="text-sm font-medium">Valor do passeio (R$)</label>
        <input id="reserva-valor" name="valor" value={valor} onChange={(e) => setValor(e.target.value)}
          aria-invalid={erro('valor') ? true : undefined} aria-describedby="reserva-valor-dica" className={campo} />
        <Dica id="reserva-valor-dica" erro={erro('valor')}>
          Deixe em branco para pessoas × {formatarReais(precoCentavos)}. Preencha só se houver desconto. Sem os extras.
        </Dica>
      </div>
      {extras.length > 0 && (
        <fieldset className="flex flex-col gap-2" aria-describedby={erro('extras') ? 'reserva-extras-erro' : undefined}>
          <legend className="text-sm font-medium">Extras</legend>
          {extras.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-3">
              <input id={`reserva-extra-${e.id}`} name={campoDoExtra(e.id)} type="number" inputMode="numeric" min={0} max={500} placeholder="0"
                value={itens[e.id]} onChange={(ev) => setItens({ ...itens, [e.id]: ev.target.value })} className={`${campo} w-24`} />
              <label htmlFor={`reserva-extra-${e.id}`} className="text-sm">
                {e.nome} · {formatarReais(e.preco_centavos)} {COBRANCAS[e.cobranca].toLowerCase()}
              </label>
              {pessoas > 0 && itens[e.id] === '' && (
                <button type="button" onClick={() => setItens({ ...itens, [e.id]: String(quantidadeSugerida(e.cobranca, pessoas)) })}
                  className="min-h-11 text-sm text-primaria underline">Incluir {quantidadeSugerida(e.cobranca, pessoas)}<span className="sr-only"> {e.nome}</span></button>
              )}
            </div>
          ))}
          {erro('extras') && <p id="reserva-extras-erro" role="alert" className="text-sm text-despesa">{erro('extras')}</p>}
        </fieldset>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="observacao" className="text-sm font-medium">Observação</label>
        <textarea id="observacao" name="observacao" rows={2} defaultValue={v.observacao} className="rounded-xl border border-controle bg-superficie px-3 py-2 text-base" />
        {erro('observacao') && <p role="alert" className="text-sm text-despesa">{erro('observacao')}</p>}
      </div>
      <p aria-live="polite" className="font-semibold">
        Total: {formatarReais(totalComExtras(base, vendidos))}
        {vendidos.length > 0 && <span className="font-normal text-tinta-suave"> (passeio {formatarReais(base)} + extras {formatarReais(totalComExtras(0, vendidos))})</span>}
      </p>
    </>
  )
}

export function ReservaForm({ saidaId, clienteId, ...resto }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(criarReserva.bind(null, saidaId, clienteId), {})
  const v = estado.valores ?? { qtd: '1', valor: '', observacao: '' }
  return (
    <form action={enviar} className="flex max-w-xl flex-col gap-4">
      <Mensagem estado={estado} />
      <Campos key={estado.versao ?? 'inicial'} v={v} estado={estado} {...resto} />
      <div><BotaoEnviar>Reservar</BotaoEnviar></div>
    </form>
  )
}
