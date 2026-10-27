'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { rodapeForm } from '@/components/tela/estilos'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Campo } from '@/components/auth/Campo'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

type Valores = { nome: string; destino: string; descricao: string; inclui: string; nao_inclui: string; tipo?: string; dias?: string }
type Props = { acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>; inicial: Valores; rotuloBotao: string }

// R164: one-day tour or excursion of several days (the itinerary is filled on the tour page).
function TipoEDias({ inicial, erro }: { inicial: Valores; erro?: string }) {
  const [tipo, setTipo] = useState(inicial.tipo ?? 'individual')
  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor="passeio-tipo" className="text-sm font-medium">Tipo</label>
        <select id="passeio-tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-12 rounded-xl border border-controle bg-superficie px-3 text-base">
          <option value="individual">Passeio de um dia</option>
          <option value="excursao">Excursão de vários dias</option>
        </select>
      </div>
      {tipo === 'excursao' && <Campo nome="dias" rotulo="Número de dias" tipo="number" valor={inicial.dias ?? ''} erros={erro ? [erro] : undefined} dica="De 2 a 30. A saída é o primeiro dia." />}
    </>
  )
}

export function PasseioForm({ acao, inicial, rotuloBotao }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const v = (estado.valores as Valores | undefined) ?? inicial
  const erroDescricao = estado.campos?.descricao?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex max-w-xl flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo nome="nome" rotulo="Nome do passeio" valor={v.nome} erros={estado.campos?.nome} autoComplete="off" />
      {inicial.tipo !== 'combo' && <TipoEDias inicial={v} erro={estado.campos?.dias?.[0]} />}
      <Campo nome="destino" rotulo="Destino" valor={v.destino} erros={estado.campos?.destino} dica="Ex.: Portugal" />
      <div className="flex flex-col gap-1">
        <label htmlFor="descricao" className="text-sm font-medium">Descrição</label>
        <textarea id="descricao" name="descricao" rows={3} defaultValue={v.descricao}
          className="rounded-xl border border-controle bg-superficie px-3 py-2 text-base" />
        {erroDescricao && <p role="alert" className="text-sm text-despesa">{erroDescricao}</p>}
      </div>
      {/* Repeated in every proposal of this tour (R69). */}
      {([['inclui', 'O que inclui'], ['nao_inclui', 'O que não inclui']] as const).map(([nome, rotulo]) => (
        <div key={nome} className="flex flex-col gap-1">
          <label htmlFor={nome} className="text-sm font-medium">{rotulo}</label>
          <textarea id={nome} name={nome} rows={3} maxLength={2000} defaultValue={v[nome]} placeholder={nome === 'inclui' ? 'Ex.: aéreo, hotel com café, traslados' : 'Ex.: refeições, passeios opcionais'}
            className="rounded-xl border border-controle bg-superficie px-3 py-2 text-base" />
          {estado.campos?.[nome]?.[0] && <p role="alert" className="text-sm text-despesa">{estado.campos[nome]![0]}</p>}
        </div>
      ))}
      <div className={rodapeForm}>
        <BotaoEnviar>{rotuloBotao}</BotaoEnviar>
        <Link href="/passeios" className="text-sm text-primaria underline">Voltar</Link>
      </div>
    </form>
  )
}
