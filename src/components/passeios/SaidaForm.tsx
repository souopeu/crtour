'use client'

import { useActionState, useId, useState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Campo } from '@/components/auth/Campo'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'
import { capacidadeSugerida } from '@/lib/veiculos/veiculos'

type Valores = { data: string; capacidade: string; preco: string; situacao: string; horario: string; veiculo: string }
export type VeiculoOpcao = { id: string; nome: string; lugares: number }
type Props = {
  acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>
  inicial: Valores
  rotuloBotao: string
  veiculos: VeiculoOpcao[]
  mostrarSituacao?: boolean
}

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

// R138: choosing a vehicle suggests its seats as the capacity (never over a number the person typed).
// Remounted with the form (key = versao), so the state restarts from what was submitted.
function VeiculoECapacidade({ veiculos, inicial, erros }: {
  veiculos: VeiculoOpcao[]; inicial: Pick<Valores, 'capacidade' | 'veiculo'>; erros: Record<string, string[] | undefined> | undefined
}) {
  const id = useId()
  const lugares = (vid: string) => veiculos.find((v) => v.id === vid)?.lugares ?? null
  const [veiculo, setVeiculo] = useState(inicial.veiculo)
  const [capacidade, setCapacidade] = useState(inicial.capacidade)
  const erroCapacidade = erros?.capacidade?.[0]
  const maximo = lugares(veiculo)

  function escolher(novo: string) {
    setCapacidade(capacidadeSugerida(capacidade, lugares(veiculo), lugares(novo)))
    setVeiculo(novo)
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-veiculo`} className="text-sm font-medium">Veículo (opcional)</label>
        <select id={`${id}-veiculo`} name="veiculo" value={veiculo} onChange={(e) => escolher(e.target.value)} className={campo}>
          <option value="">Sem veículo</option>
          {veiculos.map((v) => <option key={v.id} value={v.id}>{v.nome} · {v.lugares} lugares</option>)}
        </select>
        {veiculos.length === 0 && <p className="text-sm text-tinta-suave">Cadastre vans e ônibus em Operação → Veículos.</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-capacidade`} className="text-sm font-medium">Vagas (capacidade)</label>
        <input id={`${id}-capacidade`} name="capacidade" type="number" inputMode="numeric"
          value={capacidade} onChange={(e) => setCapacidade(e.target.value)}
          aria-invalid={erroCapacidade ? true : undefined} aria-describedby={`${id}-capacidade-dica`} className={campo} />
        <p id={`${id}-capacidade-dica`} className={erroCapacidade ? 'text-sm text-despesa' : 'text-sm text-tinta-suave'} role={erroCapacidade ? 'alert' : undefined}>
          {erroCapacidade ?? (maximo ? `No máximo ${maximo}, os lugares do veículo.` : 'Lugares no ônibus, van ou barco.')}
        </p>
      </div>
    </>
  )
}

export function SaidaForm({ acao, inicial, rotuloBotao, veiculos, mostrarSituacao = false }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const v = (estado.valores as Valores | undefined) ?? inicial
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex max-w-xl flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo nome="data" rotulo="Data da saída" tipo="date" valor={v.data} erros={estado.campos?.data} />
      <Campo nome="horario" rotulo="Horário (opcional)" tipo="time" valor={v.horario} erros={estado.campos?.horario} />
      <VeiculoECapacidade veiculos={veiculos} inicial={v} erros={estado.campos} />
      <Campo nome="preco" rotulo="Preço por pessoa (R$)" valor={v.preco} erros={estado.campos?.preco} dica="Ex.: 8.900,00. Use 0 se for gratuito." />
      {mostrarSituacao && (
        <div className="flex flex-col gap-1">
          <label htmlFor="situacao" className="text-sm font-medium">Situação</label>
          <select id="situacao" name="situacao" defaultValue={v.situacao} className={campo}>
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
