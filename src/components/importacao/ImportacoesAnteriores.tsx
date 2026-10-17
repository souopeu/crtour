'use client'

import { desfazerImportacao } from '@/app/(app)/importar/actions'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'

export type ImportacaoView = { id: string; nome: string; quando: string; criados: number; ignorados: number }

export function ImportacoesAnteriores({ importacoes }: { importacoes: ImportacaoView[] }) {
  if (importacoes.length === 0) return <p className="text-sm text-tinta-suave">Nenhuma importação ainda.</p>
  return (
    <ul className="flex flex-col gap-2">
      {importacoes.map((i) => (
        <li key={i.id} className="rounded-[--radius-cartao] border border-linha bg-superficie p-3">
          <p className="font-semibold break-all">{i.nome}</p>
          <p className="text-sm text-tinta-suave">{i.quando} · {i.criados} clientes criados · {i.ignorados} ignorados</p>
          <ConfirmarExclusao
            acao={desfazerImportacao.bind(null, i.id)}
            rotulo="Desfazer importação"
            aviso={`Isso apaga os ${i.criados} clientes criados por esta importação, com suas anotações e etiquetas. Não dá para voltar atrás.`}
            rotuloConfirmar="Apagar mesmo"
          />
        </li>
      ))}
    </ul>
  )
}
