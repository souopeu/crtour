'use client'

import { useActionState, useId, useState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import { COBRANCAS } from '@/lib/extras/extras'
import type { EstadoForm } from '@/lib/forms'

export type ValoresExtra = { nome: string; preco: string; custo: string; cobranca: string; todos: string; passeios: string }
type Props = {
  acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>
  inicial: ValoresExtra
  passeios: { id: string; nome: string }[]
  mostrarCusto: boolean
  rotuloBotao: string
}

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

function Campos({ v, erros, passeios, mostrarCusto }: { v: ValoresExtra; erros: EstadoForm['campos']; passeios: Props['passeios']; mostrarCusto: boolean }) {
  const id = useId()
  const [todos, setTodos] = useState(v.todos === '1')
  const escolhidos = v.passeios.split(',').filter(Boolean)
  const erro = (n: string) => erros?.[n]?.[0]
  const texto = (n: keyof ValoresExtra, rotulo: string, dica?: string) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${n}`} className="text-sm font-medium">{rotulo}</label>
      <input id={`${id}-${n}`} name={n} defaultValue={v[n]} aria-invalid={erro(n) ? true : undefined}
        aria-describedby={erro(n) || dica ? `${id}-${n}-dica` : undefined} className={campo} />
      {(erro(n) || dica) && (
        <p id={`${id}-${n}-dica`} role={erro(n) ? 'alert' : undefined} className={erro(n) ? 'text-sm text-despesa' : 'text-sm text-tinta-suave'}>{erro(n) ?? dica}</p>
      )}
    </div>
  )

  return (
    <>
      {texto('nome', 'Nome do extra', 'Ex.: Almoço, Fotos, Kit água e protetor.')}
      <div className="grid gap-4 sm:grid-cols-2">
        {texto('preco', 'Preço de venda (R$)')}
        {mostrarCusto && texto('custo', 'Custo (R$, opcional)', 'Só o dono vê. Entra na margem da saída.')}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-cobranca`} className="text-sm font-medium">Como cobrar</label>
        <select id={`${id}-cobranca`} name="cobranca" defaultValue={v.cobranca} className={campo}>
          {Object.entries(COBRANCAS).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Em quais passeios</legend>
        <label className="inline-flex min-h-11 items-center gap-2">
          <input type="checkbox" name="todos" value="1" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
          Todos os passeios
        </label>
        {!todos && (
          passeios.length === 0
            ? <p className="text-sm text-tinta-suave">Nenhum passeio ativo.</p>
            : <div className="flex flex-wrap gap-2">
                {passeios.map((p) => (
                  <label key={p.id} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-controle px-4 text-sm has-[:checked]:border-primaria has-[:checked]:bg-primaria-suave">
                    <input type="checkbox" name="passeios" value={p.id} defaultChecked={escolhidos.includes(p.id)} />
                    {p.nome}
                  </label>
                ))}
              </div>
        )}
        {erro('passeios') && <p role="alert" className="text-sm text-despesa">{erro('passeios')}</p>}
      </fieldset>
    </>
  )
}

export function FormExtra({ acao, inicial, passeios, mostrarCusto, rotuloBotao }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const v = (estado.valores as ValoresExtra | undefined) ?? inicial
  return (
    <form action={enviar} className="flex max-w-xl flex-col gap-4">
      <Mensagem estado={estado} />
      <Campos key={estado.versao ?? 'inicial'} v={v} erros={estado.campos} passeios={passeios} mostrarCusto={mostrarCusto} />
      <div><BotaoEnviar>{rotuloBotao}</BotaoEnviar></div>
    </form>
  )
}
