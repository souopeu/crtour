import Link from 'next/link'
import type { NegociacaoLinha } from '@/lib/negociacoes/dados'
import { rotuloDaEtapa } from '@/lib/negociacoes/negociacoes'
import { formatarReais } from '@/lib/passeios/dinheiro'

export function NegociacoesDoCliente({ clienteId, negociacoes }: { clienteId: string; negociacoes: NegociacaoLinha[] }) {
  return (
    <section aria-labelledby="negociacoes-titulo" className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="negociacoes-titulo" className="text-lg font-semibold">Negociações</h2>
        <Link href={`/negociacoes/novo?cliente=${clienteId}`} className="inline-flex min-h-11 items-center text-primaria underline">Nova negociação</Link>
      </div>
      {negociacoes.length === 0 ? (
        <p className="text-sm text-tinta-suave">Nenhuma negociação para este cliente.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {negociacoes.map((n) => (
            <li key={n.id}>
              <Link href={`/negociacoes/${n.id}`} className="flex flex-col gap-1 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
                <span className="font-semibold">{n.titulo}</span>
                <span className="text-sm text-tinta-suave">
                  {rotuloDaEtapa(n.etapa)} · {n.probabilidade}% · valor {formatarReais(n.valor_centavos)} · previsto {formatarReais(n.valor_previsto_centavos)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
