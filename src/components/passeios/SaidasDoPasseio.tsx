'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Campo } from '@/components/auth/Campo'
import { Mensagem } from '@/components/auth/Mensagem'
import { formatarDataBr } from '@/lib/formato'
import type { EstadoForm } from '@/lib/forms'
import { formatarReais } from '@/lib/passeios/dinheiro'

export type SaidaDaLista = {
  id: string; data: string; horario: string | null; veiculo: string | null
  reservadas: number; capacidade: number; preco_centavos: number; situacao: string; futura: boolean
}

// R156: future departures can be marked to change price and/or seats together.
export function SaidasDoPasseio({ saidas, acao }: { saidas: SaidaDaLista[]; acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm> }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const [marcadas, setMarcadas] = useState<string[]>([])
  const [versaoVista, setVersaoVista] = useState(estado.versao)
  if (estado.versao !== versaoVista) { // a new result: clear the marks only when it worked
    setVersaoVista(estado.versao)
    if (estado.ok) setMarcadas([])
  }
  const futuras = saidas.filter((s) => s.futura).map((s) => s.id)
  const todas = futuras.length > 0 && futuras.every((id) => marcadas.includes(id))
  const v = estado.valores ?? {}

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <Mensagem estado={estado} />
      {futuras.length > 1 && (
        <button type="button" onClick={() => setMarcadas(todas ? [] : futuras)} className="min-h-11 self-start text-sm text-primaria underline">
          {todas ? 'Desmarcar todas' : 'Marcar todas as futuras'}
        </button>
      )}
      <ul className="flex flex-col gap-2">
        {saidas.map((s) => (
          <li key={s.id} className="flex items-stretch gap-2">
            {s.futura ? (
              <label className="flex min-w-11 cursor-pointer items-center justify-center">
                <input type="checkbox" name="saida" value={s.id} checked={marcadas.includes(s.id)}
                  onChange={(e) => setMarcadas(e.target.checked ? [...marcadas, s.id] : marcadas.filter((m) => m !== s.id))} />
                <span className="sr-only">Marcar a saída de {formatarDataBr(s.data)}{s.horario && ` às ${s.horario.slice(0, 5)}`}</span>
              </label>
            ) : <span className="min-w-11" aria-hidden />}
            <Link href={`/saidas/${s.id}`} className="flex min-h-14 flex-1 flex-col gap-1 rounded-[--radius-cartao] border border-linha bg-superficie p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-semibold">
                {formatarDataBr(s.data)}{s.horario && ` · ${s.horario.slice(0, 5)}`}
                {s.veiculo && <span className="font-normal text-tinta-suave"> · {s.veiculo}</span>}
              </span>
              <span className="flex flex-wrap gap-x-3 text-sm text-tinta-suave">
                <span>Vagas: {s.reservadas} / {s.capacidade}</span>
                <span>{formatarReais(s.preco_centavos)} por pessoa</span>
                <span className={s.situacao === 'Cancelada' ? 'text-despesa' : ''}>{s.situacao}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {marcadas.length > 0 && (
        <fieldset className="flex flex-col gap-3 rounded-[--radius-cartao] border border-linha bg-superficie-suave p-4">
          <legend className="px-1 font-semibold">{marcadas.length} {marcadas.length === 1 ? 'saída marcada' : 'saídas marcadas'}</legend>
          <p className="text-sm text-tinta-suave">Deixe em branco o que não muda. Reservas já feitas não mudam de valor.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo nome="preco" rotulo="Novo preço por pessoa (R$)" valor={v.preco ?? ''} erros={estado.campos?.preco} />
            <Campo nome="capacidade" rotulo="Novas vagas" tipo="number" valor={v.capacidade ?? ''} erros={estado.campos?.capacidade} />
          </div>
          <div><BotaoEnviar>Aplicar às marcadas</BotaoEnviar></div>
        </fieldset>
      )}
    </form>
  )
}
