'use client'

import { useActionState } from 'react'
import { criarReserva } from '@/app/(app)/saidas/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Campo } from '@/components/auth/Campo'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

type Props = { saidaId: string; clienteId: string; vagasLivres: number; precoPorPessoa: string }

export function ReservaForm({ saidaId, clienteId, vagasLivres, precoPorPessoa }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(criarReserva.bind(null, saidaId, clienteId), {})
  const v = estado.valores ?? { qtd: '1', valor: '', observacao: '' }
  const erroObs = estado.campos?.observacao?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex max-w-xl flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo nome="qtd" rotulo="Número de pessoas" tipo="number" valor={v.qtd} erros={estado.campos?.qtd} dica={`Restam ${vagasLivres} ${vagasLivres === 1 ? 'vaga' : 'vagas'}.`} />
      <Campo nome="valor" rotulo="Valor total (R$)" valor={v.valor} erros={estado.campos?.valor} dica={`Deixe em branco para pessoas × ${precoPorPessoa}. Preencha só se houver desconto.`} />
      <div className="flex flex-col gap-1">
        <label htmlFor="observacao" className="text-sm font-medium">Observação</label>
        <textarea id="observacao" name="observacao" rows={2} defaultValue={v.observacao}
          className="rounded-xl border border-controle bg-superficie px-3 py-2 text-base" />
        {erroObs && <p role="alert" className="text-sm text-despesa">{erroObs}</p>}
      </div>
      <div><BotaoEnviar>Reservar</BotaoEnviar></div>
    </form>
  )
}
