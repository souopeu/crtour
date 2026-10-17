'use client'

import { useActionState } from 'react'
import { criarFornecedor } from '@/app/(app)/fornecedores/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import { TIPOS_FORNECEDOR } from '@/lib/custos/custos'
import type { EstadoForm } from '@/lib/forms'

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

export function FormFornecedor() {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(criarFornecedor, {})
  const v = estado.valores ?? {}
  const erro = (n: string) => estado.campos?.[n]?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} aria-label="Novo fornecedor" className="grid gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-4 sm:grid-cols-3">
      <div className="sm:col-span-3"><Mensagem estado={estado} /></div>
      <div className="flex flex-col gap-1">
        <label htmlFor="forn-nome" className="text-sm font-medium">Nome</label>
        <input id="forn-nome" name="nome" defaultValue={v.nome} maxLength={120} aria-invalid={erro('nome') ? true : undefined} className={campo} />
        {erro('nome') && <p role="alert" className="text-sm text-despesa">{erro('nome')}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="forn-tipo" className="text-sm font-medium">Tipo</label>
        <select id="forn-tipo" name="tipo" defaultValue={v.tipo ?? 'transporte'} className={campo}>
          {TIPOS_FORNECEDOR.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="forn-contato" className="text-sm font-medium">Contato (opcional)</label>
        <input id="forn-contato" name="contato" defaultValue={v.contato} maxLength={200} placeholder="Telefone, e-mail ou site" className={campo} />
      </div>
      <div className="sm:col-span-3"><BotaoEnviar>Cadastrar fornecedor</BotaoEnviar></div>
    </form>
  )
}
