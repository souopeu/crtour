'use client'

import { useActionState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Campo } from '@/components/auth/Campo'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

type Valores = { data: string; capacidade: string; preco: string; situacao: string }
type Props = {
  acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>
  inicial: Valores
  rotuloBotao: string
  mostrarSituacao?: boolean
}

export function SaidaForm({ acao, inicial, rotuloBotao, mostrarSituacao = false }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const v = (estado.valores as Valores | undefined) ?? inicial
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex max-w-xl flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo nome="data" rotulo="Data da saída" tipo="date" valor={v.data} erros={estado.campos?.data} />
      <Campo nome="capacidade" rotulo="Vagas (capacidade)" tipo="number" valor={v.capacidade} erros={estado.campos?.capacidade} dica="Lugares no ônibus, van ou barco." />
      <Campo nome="preco" rotulo="Preço por pessoa (R$)" valor={v.preco} erros={estado.campos?.preco} dica="Ex.: 8.900,00. Use 0 se for gratuito." />
      {mostrarSituacao && (
        <div className="flex flex-col gap-1">
          <label htmlFor="situacao" className="text-sm font-medium">Situação</label>
          <select id="situacao" name="situacao" defaultValue={v.situacao}
            className="h-12 rounded-xl border border-controle bg-superficie px-3 text-base">
            <option value="aberta">Aberta</option>
            <option value="encerrada">Encerrada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      )}
      <div><BotaoEnviar>{rotuloBotao}</BotaoEnviar></div>
    </form>
  )
}
