'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'
import { pagarLote } from '@/app/(app)/financeiro/pagamentos-actions'
import { Mensagem } from '@/components/auth/Mensagem'
import type { GrupoRepasse } from '@/lib/financeiro/pagamentosFeitos'
import { formatarDataBr } from '@/lib/formato'
import type { EstadoForm } from '@/lib/forms'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { CamposPagamentoFeito } from './FormPagamentoFeito'

const chave = (l: { origem: string; id: string }) => `${l.origem}:${l.id}`

// R150: what is still to pay, per supplier; check lines (or a whole supplier) and pay them at once.
export function Repasses({ grupos, hoje }: { grupos: GrupoRepasse[]; hoje: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoForm, FormData>(pagarLote, {})
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set())
  const valor = useMemo(() => new Map(grupos.flatMap((g) => g.linhas.map((l) => [chave(l), l.valor] as const))), [grupos])
  // Paid lines leave the list after saving; only the checked lines still on screen count.
  const ativos = [...marcados].filter((k) => valor.has(k))
  const total = ativos.reduce((s, k) => s + (valor.get(k) ?? 0), 0)

  const alternar = (ks: string[], ligar: boolean) => setMarcados((atual) => {
    const proximo = new Set(atual)
    for (const k of ks) { if (ligar) proximo.add(k); else proximo.delete(k) }
    return proximo
  })

  // Same component when the list empties, so the confirmation of the last batch stays on screen.
  if (grupos.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <Mensagem estado={estado} />
        <p className="rounded-(--radius-cartao) border border-dashed border-controle bg-superficie p-5">
          Nada a pagar a fornecedores. Aqui aparecem as contas e os custos das saídas ligados a um fornecedor. <Link href="/financeiro/contas" className="text-primaria underline">Ver contas a pagar</Link>
        </p>
      </div>
    )
  }
  return (
    <form action={enviar} aria-label="Pagar fornecedores" className="flex flex-col gap-4">
      <Mensagem estado={estado} />
      {grupos.map((g) => {
        const ks = g.linhas.map(chave)
        const todos = ks.every((k) => marcados.has(k))
        return (
          <fieldset key={g.fornecedorId} className="rounded-(--radius-cartao) border border-linha bg-superficie p-3">
            <legend className="flex w-full items-center justify-between gap-2 px-1">
              <label className="inline-flex min-h-11 items-center gap-2 font-semibold">
                <input type="checkbox" checked={todos} onChange={(e) => alternar(ks, e.target.checked)} className="size-4 accent-(--color-marca)" />
                {g.fornecedor}
              </label>
              <span className="text-sm tabular-nums">{formatarReais(g.total)}</span>
            </legend>
            <ul className="flex flex-col divide-y divide-linha">
              {g.linhas.map((l) => (
                <li key={chave(l)} className="flex items-center justify-between gap-2 py-1.5">
                  <label className="inline-flex min-h-11 min-w-0 items-center gap-2 text-sm">
                    <input type="checkbox" name="item" value={chave(l)} checked={marcados.has(chave(l))} onChange={(e) => alternar([chave(l)], e.target.checked)} className="size-4 accent-(--color-marca)" />
                    <span className="min-w-0">
                      <Link href={l.href} className="text-primaria underline">{l.descricao}</Link>
                      <span className="block text-xs text-tinta-suave">{l.vencimento ? `vence ${formatarDataBr(l.vencimento)}` : 'sem vencimento'}{l.parcela ? ` · ${l.parcela}` : ''}</span>
                    </span>
                  </label>
                  <span className="text-sm tabular-nums">{formatarReais(l.valor)}</span>
                </li>
              ))}
            </ul>
          </fieldset>
        )
      })}
      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-linha bg-papel py-3">
        <p aria-live="polite" className="font-semibold">{ativos.length} {ativos.length === 1 ? 'lançamento marcado' : 'lançamentos marcados'} · {formatarReais(total)}</p>
        <CamposPagamentoFeito hoje={hoje} erros={estado.campos} />
        {estado.campos?.itens?.[0] && <p role="alert" className="text-sm text-despesa">{estado.campos.itens[0]}</p>}
        <div><button type="submit" disabled={enviando || ativos.length === 0} className="min-h-11 rounded-lg bg-marca px-5 font-semibold text-white disabled:opacity-50">{enviando ? 'Aguarde…' : 'Pagar selecionados'}</button></div>
      </div>
    </form>
  )
}
