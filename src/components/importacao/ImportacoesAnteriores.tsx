'use client'

import { useState } from 'react'
import { desfazerImportacao } from '@/app/(app)/importar/actions'

export type ImportacaoView = { id: string; nome: string; quando: string; criados: number; ignorados: number }

export function ImportacoesAnteriores({ importacoes }: { importacoes: ImportacaoView[] }) {
  const [confirmando, setConfirmando] = useState<string | null>(null)

  if (importacoes.length === 0) return <p className="text-sm text-tinta-suave">Nenhuma importação ainda.</p>
  return (
    <ul className="flex flex-col gap-2">
      {importacoes.map((i) => (
        <li key={i.id} className="rounded-[--radius-cartao] border border-linha bg-superficie p-3">
          <p className="font-semibold break-all">{i.nome}</p>
          <p className="text-sm text-tinta-suave">{i.quando} · {i.criados} clientes criados · {i.ignorados} ignorados</p>
          {confirmando === i.id ? (
            <form action={desfazerImportacao.bind(null, i.id)} className="mt-2 flex flex-col gap-2">
              <p role="alert" className="text-sm text-despesa">
                Isso apaga os {i.criados} clientes criados por esta importação, com suas anotações e etiquetas. Não dá para voltar atrás.
              </p>
              <div className="flex gap-3">
                <button type="submit" className="min-h-11 rounded-full bg-despesa px-4 font-semibold text-white">Apagar mesmo</button>
                <button type="button" onClick={() => setConfirmando(null)} className="min-h-11 px-4 underline">Cancelar</button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setConfirmando(i.id)} className="mt-2 min-h-11 text-despesa underline">Desfazer importação</button>
          )}
        </li>
      ))}
    </ul>
  )
}
