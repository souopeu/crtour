'use client'

import { useActionState } from 'react'
import { criarCampanha } from '@/app/(app)/campanhas/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import { CANAIS } from '@/lib/campanhas/campanhas'
import type { EstadoForm } from '@/lib/forms'

const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

function Campo({ id, rotulo, erro, children }: { id: string; rotulo: string; erro?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
      {children}
      {erro && <p role="alert" className="text-sm text-despesa">{erro}</p>}
    </div>
  )
}

export function FormCampanha({ hoje }: { hoje: string }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(criarCampanha, {})
  const v = estado.valores ?? {}
  const e = (n: string) => estado.campos?.[n]?.[0]
  return (
    <form key={estado.versao ?? 'inicial'} id="nova-campanha" action={enviar} aria-label="Nova campanha" className="grid gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-4 sm:grid-cols-3">
      <div className="sm:col-span-3"><Mensagem estado={estado} /></div>
      <Campo id="camp-nome" rotulo="Nome" erro={e('nome')}>
        <input id="camp-nome" name="nome" defaultValue={v.nome} maxLength={120} placeholder="Verão no Google" aria-invalid={e('nome') ? true : undefined} className={campo} />
      </Campo>
      <Campo id="camp-canal" rotulo="Onde roda" erro={e('canal')}>
        <select id="camp-canal" name="canal" defaultValue={v.canal ?? 'meta'} className={campo}>
          {CANAIS.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
        </select>
      </Campo>
      <Campo id="camp-utm" rotulo="Etiqueta do link (utm_campaign)" erro={e('utm')}>
        <input id="camp-utm" name="utm" defaultValue={v.utm} maxLength={100} placeholder="verao-2027" aria-invalid={e('utm') ? true : undefined} className={campo} />
      </Campo>
      <Campo id="camp-inicio" rotulo="Início" erro={e('inicio')}>
        <input id="camp-inicio" name="inicio" type="date" defaultValue={v.inicio ?? hoje} aria-invalid={e('inicio') ? true : undefined} className={campo} />
      </Campo>
      <Campo id="camp-fim" rotulo="Fim (opcional)" erro={e('fim')}>
        <input id="camp-fim" name="fim" type="date" defaultValue={v.fim} aria-invalid={e('fim') ? true : undefined} className={campo} />
      </Campo>
      <Campo id="camp-gasto" rotulo="Gasto total (R$, opcional)" erro={e('gasto')}>
        <input id="camp-gasto" name="gasto" inputMode="decimal" defaultValue={v.gasto} placeholder="1.500,00" aria-invalid={e('gasto') ? true : undefined} className={campo} />
      </Campo>
      <div className="sm:col-span-3"><BotaoEnviar>Cadastrar campanha</BotaoEnviar></div>
    </form>
  )
}
