'use client'

import { useActionState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import { COBRANCAS, quantidadeSugerida, type Cobranca } from '@/lib/extras/extras'
import type { EstadoForm } from '@/lib/forms'
import { formatarReais } from '@/lib/passeios/dinheiro'

type Props = {
  acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>
  extras: { id: string; nome: string; preco_centavos: number; cobranca: Cobranca }[]
  pessoas: number
}
const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

export function AdicionarExtra({ acao, extras, pessoas }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const v = estado.valores ?? {}
  const erro = (n: string) => estado.campos?.[n]?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} aria-label="Incluir extra" className="flex flex-col gap-3">
      <Mensagem estado={estado} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="extra-escolhido" className="text-sm font-medium">Extra</label>
          <select id="extra-escolhido" name="extra" defaultValue={v.extra ?? ''} aria-invalid={erro('extra') ? true : undefined} className={campo}>
            <option value="">Escolha…</option>
            {extras.map((e) => <option key={e.id} value={e.id}>{e.nome} · {formatarReais(e.preco_centavos)} {COBRANCAS[e.cobranca].toLowerCase()}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="extra-quantidade" className="text-sm font-medium">Quantidade</label>
          <input id="extra-quantidade" name="quantidade" type="number" inputMode="numeric" min={1} max={500}
            defaultValue={v.quantidade ?? String(quantidadeSugerida('por_pessoa', pessoas))} aria-invalid={erro('quantidade') ? true : undefined} className={`${campo} w-28`} />
        </div>
        <BotaoEnviar>Incluir extra</BotaoEnviar>
      </div>
      {(erro('extra') || erro('quantidade')) && <p role="alert" className="text-sm text-despesa">{erro('extra') ?? erro('quantidade')}</p>}
    </form>
  )
}
