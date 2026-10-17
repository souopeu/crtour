'use client'

import { useActionState } from 'react'
import { adicionarAnotacao, apagarAnotacao } from '@/app/(app)/clientes/anotacoes-actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

export type AnotacaoView = { id: string; autor: string; quando: string; texto: string; podeApagar: boolean }

export function AnotacoesCliente({ clienteId, anotacoes }: { clienteId: string; anotacoes: AnotacaoView[] }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(adicionarAnotacao.bind(null, clienteId), {})
  const erro = estado.campos?.texto?.[0]

  return (
    <section aria-labelledby="anotacoes-titulo" className="w-full">
      <h2 id="anotacoes-titulo" className="mb-2 text-lg font-semibold">Anotações</h2>

      <form key={estado.versao ?? 'inicial'} action={enviar} className="mb-4 flex flex-col gap-2">
        <Mensagem estado={estado} />
        <label htmlFor="texto" className="text-sm font-medium">Nova anotação</label>
        <textarea
          id="texto" name="texto" rows={3} defaultValue={estado.valores?.texto}
          aria-invalid={erro ? true : undefined} aria-describedby={erro ? 'texto-erro' : undefined}
          className="rounded-xl border border-controle bg-superficie px-3 py-2 text-base"
        />
        {erro && <p id="texto-erro" role="alert" className="text-sm text-despesa">{erro}</p>}
        <div><BotaoEnviar>Salvar anotação</BotaoEnviar></div>
      </form>

      {anotacoes.length === 0 ? (
        <p className="text-sm text-tinta-suave">Nenhuma anotação ainda.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {anotacoes.map((a) => (
            <li key={a.id} className="rounded-[--radius-cartao] border border-linha bg-superficie p-3">
              <p className="whitespace-pre-wrap break-words">{a.texto}</p>
              <div className="mt-2 flex items-center justify-between gap-2 text-sm text-tinta-suave">
                <span>{a.autor} · {a.quando}</span>
                {a.podeApagar && (
                  <form action={apagarAnotacao.bind(null, clienteId, a.id)}>
                    <button type="submit" className="min-h-11 px-2 text-despesa underline">Apagar</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
