'use client'

import { campoResposta, type Pergunta } from '@/lib/perguntas/perguntas'

type Props = {
  perguntas: Pergunta[]
  pessoas: number
  valores: Record<string, string>         // field name → answer already given or typed
  erros?: Record<string, string[] | undefined>
  nomes?: string[]                        // names by place (1 = responsible), when known
}
const campo = 'h-12 w-full rounded-xl border border-controle bg-superficie px-3 text-base'

function Campo({ p, nome, rotulo, valor, erro }: { p: Pergunta; nome: string; rotulo: string; valor: string; erro?: string }) {
  const id = `campo-${nome.replace(/[^a-z0-9]/gi, '-')}`
  const comum = { id, name: nome, defaultValue: valor, 'aria-invalid': erro ? true : undefined, 'aria-describedby': erro ? `${id}-erro` : undefined }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{rotulo}{p.obrigatoria && <span className="text-tinta-suave"> (obrigatória)</span>}</label>
      {p.tipo === 'sim_nao' || p.tipo === 'escolha' ? (
        <select {...comum} className={campo}>
          <option value="">Sem resposta</option>
          {(p.tipo === 'sim_nao' ? ['Sim', 'Não'] : (p.opcoes ?? [])).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input {...comum} inputMode={p.tipo === 'numero' ? 'decimal' : undefined} maxLength={500} className={campo} />
      )}
      {erro && <p id={`${id}-erro`} role="alert" className="text-sm text-despesa">{erro}</p>}
    </div>
  )
}

// R161: questions for the whole reservation first, then one group per person for per-passenger questions.
export function CamposRespostas({ perguntas, pessoas, valores, erros, nomes = [] }: Props) {
  const porReserva = perguntas.filter((p) => !p.por_passageiro)
  const porPessoa = perguntas.filter((p) => p.por_passageiro)
  const lugares = Array.from({ length: Math.min(Math.max(pessoas, 0), 500) }, (_, i) => i + 1)
  const pessoa = (l: number) => nomes[l - 1] ?? (l === 1 ? 'Pessoa 1 (responsável)' : `Pessoa ${l}`)
  if (perguntas.length === 0) return null
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Perguntas antes do passeio</legend>
      {porReserva.map((p) => (
        <Campo key={p.id} p={p} nome={campoResposta(p.id)} rotulo={p.texto} valor={valores[campoResposta(p.id)] ?? ''} erro={erros?.[campoResposta(p.id)]?.[0]} />
      ))}
      {porPessoa.length > 0 && lugares.map((l) => (
        <fieldset key={l} className="flex flex-col gap-3 rounded-[--radius-cartao] border border-linha p-3">
          <legend className="px-1 text-sm font-semibold">{pessoa(l)}</legend>
          {porPessoa.map((p) => (
            <Campo key={p.id} p={p} nome={campoResposta(p.id, l)} rotulo={p.texto} valor={valores[campoResposta(p.id, l)] ?? ''} erro={erros?.[campoResposta(p.id, l)]?.[0]} />
          ))}
        </fieldset>
      ))}
    </fieldset>
  )
}
