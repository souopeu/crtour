'use client'

import { useActionState } from 'react'
import { alterarValorTotal, definirVencimento, registrarPagamento } from '@/app/(app)/reservas/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Campo } from '@/components/auth/Campo'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

const select = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

export function PagamentoForm({ reservaId, hoje, saldoSugerido }: { reservaId: string; hoje: string; saldoSugerido: string }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(registrarPagamento.bind(null, reservaId), {})
  const v = estado.valores ?? { valor: '', tipo: 'sinal', forma: 'pix', data: hoje, observacao: '' }
  const erroObs = estado.campos?.observacao?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex max-w-xl flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo nome="valor" rotulo="Valor (R$)" valor={v.valor} erros={estado.campos?.valor} dica={`Falta ${saldoSugerido}. Ex.: 500,00`} />
      <div className="flex flex-col gap-1">
        <label htmlFor="tipo" className="text-sm font-medium">Tipo</label>
        <select id="tipo" name="tipo" defaultValue={v.tipo} className={select}>
          <option value="sinal">Sinal (entrada)</option>
          <option value="parcela">Parcela</option>
          <option value="saldo">Saldo (quitação)</option>
        </select>
        {estado.campos?.tipo?.[0] && <p role="alert" className="text-sm text-despesa">{estado.campos.tipo[0]}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="forma" className="text-sm font-medium">Forma de pagamento</label>
        <select id="forma" name="forma" defaultValue={v.forma} className={select}>
          <option value="pix">Pix</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="cartao">Cartão</option>
          <option value="transferencia">Transferência</option>
          <option value="outro">Outro</option>
        </select>
      </div>
      <Campo nome="data" rotulo="Data do pagamento" tipo="date" valor={v.data} erros={estado.campos?.data} />
      <div className="flex flex-col gap-1">
        <label htmlFor="observacao" className="text-sm font-medium">Observação</label>
        <textarea id="observacao" name="observacao" rows={2} defaultValue={v.observacao} className="rounded-xl border border-controle bg-superficie px-3 py-2 text-base" />
        {erroObs && <p role="alert" className="text-sm text-despesa">{erroObs}</p>}
      </div>
      <div><BotaoEnviar>Registrar pagamento</BotaoEnviar></div>
    </form>
  )
}

export function VencimentoForm({ reservaId, atual }: { reservaId: string; atual: string }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(definirVencimento.bind(null, reservaId), {})
  const v = estado.valores?.data ?? atual
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex max-w-xl flex-col gap-3">
      <Mensagem estado={estado} />
      <Campo nome="data" id="vencimento-data" rotulo="Vencimento do saldo" tipo="date" valor={v} erros={estado.campos?.data} dica="Deixe em branco para remover." />
      <div><BotaoEnviar>Salvar vencimento</BotaoEnviar></div>
    </form>
  )
}

export function TotalForm({ reservaId, atual }: { reservaId: string; atual: string }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(alterarValorTotal.bind(null, reservaId), {})
  const v = estado.valores?.valor ?? atual
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex max-w-xl flex-col gap-3">
      <Mensagem estado={estado} />
      <Campo nome="valor" id="total-valor" rotulo="Valor total da reserva (R$)" valor={v} erros={estado.campos?.valor} dica="Use para dar desconto ou corrigir o valor. Não pode ficar abaixo do que já foi pago." />
      <div><BotaoEnviar>Salvar valor total</BotaoEnviar></div>
    </form>
  )
}
