'use client'

import { useActionState, useState } from 'react'
import { adicionarCusto } from '@/app/(app)/fornecedores/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

export function FormCusto({ saidaId, fornecedores }: { saidaId: string; fornecedores: { id: string; nome: string }[] }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(adicionarCusto.bind(null, saidaId), {})
  const v = estado.valores ?? {}
  const [pago, setPago] = useState(v.pago === 'on')
  const erro = (n: string) => estado.campos?.[n]?.[0]
  const msg = (n: string) => erro(n) && <p role="alert" className="text-sm text-despesa">{erro(n)}</p>
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} aria-label="Novo custo" className="flex flex-col gap-2">
      <Mensagem estado={estado} />
      <label htmlFor="custo-descricao" className="text-sm font-medium">Descrição</label>
      <input id="custo-descricao" name="descricao" defaultValue={v.descricao} maxLength={200} placeholder="Ex.: ônibus ida e volta" className={campo} />
      {msg('descricao')}
      <label htmlFor="custo-valor" className="text-sm font-medium">Valor do custo (R$)</label>
      <input id="custo-valor" name="valor" inputMode="decimal" defaultValue={v.valor} className={campo} />
      {msg('valor')}
      <label htmlFor="custo-fornecedor" className="text-sm font-medium">Fornecedor (opcional)</label>
      <select id="custo-fornecedor" name="fornecedor" defaultValue={v.fornecedor ?? ''} className={campo}>
        <option value="">Nenhum</option>
        {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
      </select>
      {msg('fornecedor')}
      <label htmlFor="custo-vencimento" className="text-sm font-medium">Vencimento (opcional)</label>
      <input id="custo-vencimento" name="vencimento" type="date" defaultValue={v.vencimento} className={campo} />
      {msg('vencimento')}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="pago" checked={pago} onChange={(e) => setPago(e.target.checked)} className="size-5" /> Já foi pago
      </label>
      {pago && (
        <>
          <label htmlFor="custo-data-pagamento" className="text-sm font-medium">Data do pagamento</label>
          <input id="custo-data-pagamento" name="dataPagamento" type="date" defaultValue={v.dataPagamento} className={campo} />
          {msg('dataPagamento')}
        </>
      )}
      <div><BotaoEnviar>Adicionar custo</BotaoEnviar></div>
    </form>
  )
}
