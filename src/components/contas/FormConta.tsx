'use client'

import { useActionState, useId, useState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import { CATEGORIAS_CONTA, MAX_PARCELAS, rotuloCategoriaConta } from '@/lib/contas/contas'
import type { EstadoForm } from '@/lib/forms'

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'
type Valores = Record<string, string>

function Erro({ texto }: { texto?: string }) {
  return texto ? <p role="alert" className="text-sm text-despesa">{texto}</p> : null
}

// R145–R147: new bill (with "única / parcelada / mensal") or editing one (no mode: it changes only that bill).
export function FormConta({ acao, fornecedores, inicial, rotuloBotao, comModo }: {
  acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>; fornecedores: { id: string; nome: string }[]
  inicial: Valores; rotuloBotao: string; comModo: boolean
}) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const v: Valores = estado.valores ?? inicial
  const id = useId()
  const [modo, setModo] = useState(v.modo || 'unica')
  const erro = (n: string) => estado.campos?.[n]?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} aria-label={rotuloBotao} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Mensagem estado={estado} /></div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={`${id}-descricao`} className="text-sm font-medium">Descrição</label>
        <input id={`${id}-descricao`} name="descricao" defaultValue={v.descricao} maxLength={200} placeholder="Ex.: Aluguel da loja" className={campo} />
        <Erro texto={erro('descricao')} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-categoria`} className="text-sm font-medium">Categoria</label>
        <select id={`${id}-categoria`} name="categoria" defaultValue={v.categoria || 'outros'} className={campo}>
          {CATEGORIAS_CONTA.map((c) => <option key={c} value={c}>{rotuloCategoriaConta(c)}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-fornecedor`} className="text-sm font-medium">Fornecedor (opcional)</label>
        <select id={`${id}-fornecedor`} name="fornecedor" defaultValue={v.fornecedor || ''} className={campo}>
          <option value="">Sem fornecedor</option>
          {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <Erro texto={erro('fornecedor')} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-valor`} className="text-sm font-medium">{modo === 'parcelada' ? 'Valor total (R$)' : 'Valor (R$)'}</label>
        <input id={`${id}-valor`} name="valor" defaultValue={v.valor} inputMode="decimal" placeholder="2.500,00" className={campo} />
        <Erro texto={erro('valor')} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-vencimento`} className="text-sm font-medium">{modo === 'parcelada' ? 'Vencimento da 1ª parcela' : 'Vencimento'}</label>
        <input id={`${id}-vencimento`} name="vencimento" type="date" defaultValue={v.vencimento} className={campo} />
        <Erro texto={erro('vencimento')} />
      </div>
      {comModo && (
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="text-sm font-medium">Como se paga</legend>
          <div className="flex flex-wrap gap-2">
            {([['unica', 'Uma vez'], ['parcelada', 'Parcelada'], ['recorrente', 'Todo mês']] as const).map(([valor, rotulo]) => (
              <label key={valor} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-controle bg-superficie px-3 text-sm has-checked:border-marca has-checked:bg-primaria-suave">
                <input type="radio" name="modo" value={valor} checked={modo === valor} onChange={() => setModo(valor)} className="accent-(--color-marca)" />
                {rotulo}
              </label>
            ))}
          </div>
          {modo === 'parcelada' && (
            <div className="flex max-w-48 flex-col gap-1">
              <label htmlFor={`${id}-parcelas`} className="text-sm font-medium">Número de parcelas</label>
              <input id={`${id}-parcelas`} name="parcelas" type="number" inputMode="numeric" defaultValue={v.parcelas || '2'} className={campo} />
              <Erro texto={erro('parcelas')} />
              <p className="text-sm text-tinta-suave">Uma por mês, de 2 a {MAX_PARCELAS}.</p>
            </div>
          )}
          {modo === 'recorrente' && <p className="text-sm text-tinta-suave">A conta do mês seguinte aparece sozinha 30 dias antes do vencimento, até você parar a repetição.</p>}
        </fieldset>
      )}
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={`${id}-obs`} className="text-sm font-medium">Observação (opcional)</label>
        <textarea id={`${id}-obs`} name="observacao" rows={2} maxLength={1000} defaultValue={v.observacao} className="rounded-xl border border-controle bg-superficie px-3 py-2 text-base" />
        <Erro texto={erro('observacao')} />
      </div>
      <div className="sm:col-span-2"><BotaoEnviar>{rotuloBotao}</BotaoEnviar></div>
    </form>
  )
}
