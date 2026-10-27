'use client'

import { useActionState, useId, useState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Campo } from '@/components/auth/Campo'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'
import { DIAS_SEMANA, MAX_DIAS_LOTE, contarLote, datasDoLote, lerHorarios } from '@/lib/passeios/lote'
import { VeiculoECapacidade, type VeiculoOpcao } from './SaidaForm'

type Valores = { de: string; ate: string; dias: string; horarios: string; capacidade: string; preco: string; veiculo: string }
type Props = {
  acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>
  veiculos: VeiculoOpcao[]
  existentes: { data: string; horario: string | null }[]
}

const VAZIO: Valores = { de: '', ate: '', dias: '1,2,3,4,5', horarios: '', capacidade: '', preco: '', veiculo: '' }
const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

// The preview uses the same rules as the database, so "Serão criadas N" matches the result.
function previa(v: { de: string; ate: string; dias: string[]; horarios: string }, existentes: Props['existentes']): string | null {
  if (!v.de || !v.ate || v.ate < v.de) return null
  if ((Date.parse(v.ate) - Date.parse(v.de)) / 86_400_000 >= MAX_DIAS_LOTE) return null
  const horarios = lerHorarios(v.horarios)
  if (horarios === null) return null
  const { novas, puladas } = contarLote(datasDoLote(v.de, v.ate, v.dias.map(Number)), horarios, existentes)
  const pul = puladas > 0 ? ` (${puladas} já ${puladas === 1 ? 'existe e será pulada' : 'existem e serão puladas'})` : ''
  return `Serão criadas ${novas} ${novas === 1 ? 'saída' : 'saídas'}${pul}.`
}

function Campos({ inicial, estado, veiculos, existentes }: { inicial: Valores; estado: EstadoForm } & Omit<Props, 'acao'>) {
  const id = useId()
  const [de, setDe] = useState(inicial.de)
  const [ate, setAte] = useState(inicial.ate)
  const [dias, setDias] = useState(inicial.dias.split(',').filter(Boolean))
  const [horarios, setHorarios] = useState(inicial.horarios)
  const erro = (n: string) => estado.campos?.[n]?.[0]
  const texto = previa({ de, ate, dias, horarios }, existentes)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {([['de', 'Primeira data', de, setDe], ['ate', 'Última data', ate, setAte]] as const).map(([n, rotulo, valor, mudar]) => (
          <div key={n} className="flex flex-col gap-1">
            <label htmlFor={`${id}-${n}`} className="text-sm font-medium">{rotulo}</label>
            <input id={`${id}-${n}`} name={n} type="date" value={valor} onChange={(e) => mudar(e.target.value)}
              aria-invalid={erro(n) ? true : undefined} aria-describedby={erro(n) ? `${id}-${n}-erro` : undefined} className={campo} />
            {erro(n) && <p id={`${id}-${n}-erro`} role="alert" className="text-sm text-despesa">{erro(n)}</p>}
          </div>
        ))}
      </div>
      <fieldset className="flex flex-col gap-2" aria-describedby={erro('dias') ? `${id}-dias-erro` : undefined}>
        <legend className="text-sm font-medium">Dias da semana</legend>
        <div className="flex flex-wrap gap-2">
          {DIAS_SEMANA.map(([valor, rotulo]) => (
            <label key={valor} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-controle px-4 text-sm has-[:checked]:border-primaria has-[:checked]:bg-primaria-suave">
              <input type="checkbox" name="dias" value={valor} checked={dias.includes(valor)}
                onChange={(e) => setDias(e.target.checked ? [...dias, valor] : dias.filter((d) => d !== valor))} />
              {rotulo}
            </label>
          ))}
        </div>
        {erro('dias') && <p id={`${id}-dias-erro`} role="alert" className="text-sm text-despesa">{erro('dias')}</p>}
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-horarios`} className="text-sm font-medium">Horários (opcional)</label>
        <input id={`${id}-horarios`} name="horarios" value={horarios} onChange={(e) => setHorarios(e.target.value)}
          placeholder="08:00, 14:00" aria-invalid={erro('horarios') ? true : undefined} aria-describedby={`${id}-horarios-dica`} className={campo} />
        <p id={`${id}-horarios-dica`} role={erro('horarios') ? 'alert' : undefined} className={erro('horarios') ? 'text-sm text-despesa' : 'text-sm text-tinta-suave'}>
          {erro('horarios') ?? 'Separe por vírgula. Cada horário vira uma saída em cada data.'}
        </p>
      </div>
      <VeiculoECapacidade veiculos={veiculos} inicial={inicial} erros={estado.campos} />
      <Campo nome="preco" rotulo="Preço por pessoa (R$)" valor={inicial.preco} erros={estado.campos?.preco} dica="Para alta e baixa temporada, crie um lote para cada período." />
      <p aria-live="polite" className="text-sm font-medium">{texto}</p>
    </>
  )
}

// The fields only exist while the block is open, so their labels never clash with the single-departure form.
export function SaidasLoteForm({ acao, veiculos, existentes }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const [aberto, setAberto] = useState(false)
  const inicial = (estado.valores as Valores | undefined) ?? VAZIO
  return (
    <details onToggle={(e) => setAberto(e.currentTarget.open)} className="rounded-[--radius-cartao] border border-linha p-4">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">Criar várias saídas</summary>
      {aberto && (
        <form action={enviar} className="flex max-w-xl flex-col gap-4">
          <p className="text-sm text-tinta-suave">Escolha o período, os dias da semana e os horários. Datas que já têm saída no mesmo horário são puladas.</p>
          <Mensagem estado={estado} />
          <Campos key={estado.versao ?? 'inicial'} inicial={inicial} estado={estado} veiculos={veiculos} existentes={existentes} />
          <div><BotaoEnviar>Criar saídas</BotaoEnviar></div>
        </form>
      )}
    </details>
  )
}
