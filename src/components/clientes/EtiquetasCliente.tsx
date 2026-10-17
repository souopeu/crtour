'use client'

import { useActionState } from 'react'
import { adicionarEtiqueta, removerEtiqueta } from '@/app/(app)/clientes/etiquetas-actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EtiquetaLinha } from '@/lib/clientes/dados'
import type { EstadoForm } from '@/lib/forms'

type Props = { clienteId: string; aplicadas: EtiquetaLinha[]; sugestoes: EtiquetaLinha[] }

export function EtiquetasCliente({ clienteId, aplicadas, sugestoes }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(adicionarEtiqueta.bind(null, clienteId), {})
  const erro = estado.campos?.etiqueta?.[0]

  return (
    <section aria-labelledby="etiquetas-titulo" className="w-full">
      <h2 id="etiquetas-titulo" className="mb-2 text-lg font-semibold">Etiquetas</h2>

      {aplicadas.length === 0 ? (
        <p className="mb-3 text-sm text-tinta-suave">Nenhuma etiqueta ainda. Use etiquetas para agrupar clientes (ex.: Europa, VIP).</p>
      ) : (
        <ul className="mb-3 flex flex-wrap gap-2">
          {aplicadas.map((e) => (
            <li key={e.id} className="flex items-center gap-1 rounded-full bg-primaria-suave py-1 pl-3 pr-1 text-sm">
              <span>{e.nome}</span>
              <form action={removerEtiqueta.bind(null, clienteId, e.id)}>
                <button type="submit" aria-label={`Remover etiqueta ${e.nome}`} className="grid size-8 place-items-center rounded-full">×</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form key={estado.versao ?? 'inicial'} action={enviar} className="flex flex-col gap-2">
        <Mensagem estado={estado} />
        <label htmlFor="etiqueta" className="text-sm font-medium">Adicionar etiqueta</label>
        <div className="flex gap-2">
          <input
            id="etiqueta" name="etiqueta" list="etiquetas-sugeridas" autoComplete="off"
            aria-invalid={erro ? true : undefined} aria-describedby={erro ? 'etiqueta-erro' : undefined}
            className="h-12 min-w-0 flex-1 rounded-xl border border-controle bg-superficie px-3 text-base"
          />
          <datalist id="etiquetas-sugeridas">
            {sugestoes.map((s) => <option key={s.id} value={s.nome} />)}
          </datalist>
          <BotaoEnviar>Adicionar</BotaoEnviar>
        </div>
        {erro && <p id="etiqueta-erro" role="alert" className="text-sm text-despesa">{erro}</p>}
      </form>
    </section>
  )
}
