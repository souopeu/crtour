'use client'

import { desfazerImportacaoReservas } from '@/app/(app)/importar/reservas/actions'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'

export type ImportacaoReservasView = { id: string; nome: string; quando: string; criadas: number; recusadas: number }

export function ImportacoesReservasAnteriores({ importacoes }: { importacoes: ImportacaoReservasView[] }) {
  if (importacoes.length === 0) return <p className="text-sm text-tinta-suave">Nenhuma importação de reservas ainda.</p>
  return (
    <ul className="flex flex-col gap-2">
      {importacoes.map((i) => (
        <li key={i.id} className="rounded-[--radius-cartao] border border-linha bg-superficie p-3">
          <p className="font-semibold break-all">{i.nome}</p>
          <p className="text-sm text-tinta-suave">{i.quando} · {i.criadas} reservas criadas · {i.recusadas} recusadas</p>
          <ConfirmarExclusao acao={desfazerImportacaoReservas.bind(null, i.id)} rotulo="Desfazer importação"
            aviso={`Isso apaga as ${i.criadas} reservas desta importação e os pagamentos registrados junto. Só funciona se ninguém mexeu nelas depois.`}
            rotuloConfirmar="Apagar mesmo" />
        </li>
      ))}
    </ul>
  )
}
