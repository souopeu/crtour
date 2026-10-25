'use client'

import { useActionState } from 'react'
import { criarServicoSobMedida } from '@/app/(app)/reservas/sob-medida-actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Campo } from '@/components/auth/Campo'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

// R142: the service, its date and the agreed total for the chosen client.
export function FormSobMedida({ clienteId, hoje }: { clienteId: string; hoje: string }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(criarServicoSobMedida, {})
  const v = estado.valores ?? { nome: '', data: hoje, horario: '', pessoas: '1', valor: '', observacao: '' }
  const erroObs = estado.campos?.observacao?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} aria-label="Serviço sob medida" className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="cliente" value={clienteId} />
      <Mensagem estado={estado} />
      {estado.campos?.cliente?.[0] && <p role="alert" className="text-sm text-despesa">{estado.campos.cliente[0]}</p>}
      <Campo nome="nome" rotulo="Serviço" valor={v.nome} erros={estado.campos?.nome} dica="Ex.: Transfer aeroporto → hotel, City tour privativo." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="data" rotulo="Data" tipo="date" valor={v.data} erros={estado.campos?.data} />
        <Campo nome="horario" rotulo="Horário (opcional)" tipo="time" valor={v.horario} erros={estado.campos?.horario} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="pessoas" rotulo="Número de pessoas" tipo="number" valor={v.pessoas} erros={estado.campos?.pessoas} />
        <Campo nome="valor" rotulo="Valor total combinado (R$)" valor={v.valor} erros={estado.campos?.valor} dica="Ex.: 450,00. Use 0 se for cortesia." />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="sob-medida-obs" className="text-sm font-medium">Observação (opcional)</label>
        <textarea id="sob-medida-obs" name="observacao" rows={2} defaultValue={v.observacao} maxLength={1000}
          className="rounded-xl border border-controle bg-superficie px-3 py-2 text-base" />
        {erroObs && <p role="alert" className="text-sm text-despesa">{erroObs}</p>}
      </div>
      <div><BotaoEnviar>Criar reserva</BotaoEnviar></div>
    </form>
  )
}
