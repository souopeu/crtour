'use client'

import { useId, useState } from 'react'
import { z } from 'zod'
import { ehBrasil, UFS } from '@/lib/clientes/local'
import { mascararWhatsapp, normalizarWhatsapp } from '@/lib/clientes/whatsapp'

const classeCampo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'
const ERRO_WHATSAPP = 'WhatsApp inválido. Use DDD + número, ou +código do país.'
const ERRO_EMAIL = 'Digite um e-mail válido.'

type Base = { valor: string; erros?: string[] }

// Same markup as <Campo>, plus an error shown when leaving the field (R124, R125); the server still validates.
function Rotulado({ id, rotulo, erro, dica, children }: { id: string; rotulo: string; erro?: string; dica?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
      {children}
      {dica && !erro && <p className="text-sm text-tinta-suave">{dica}</p>}
      {erro ? <p id={`${id}-erro`} role="alert" className="text-sm text-despesa">{erro}</p> : null}
    </div>
  )
}

// shortcut: the mask rewrites the whole value, so the caret jumps to the end when editing in the middle; fine for a phone field.
export function CampoWhatsapp({ valor, erros }: Base) {
  const [texto, setTexto] = useState(mascararWhatsapp(valor))
  const [erro, setErro] = useState(erros?.[0])
  const id = `${useId()}-whatsapp` // unique: Next keeps the previous page's form hidden in the DOM
  return (
    <Rotulado id={id} rotulo="WhatsApp" erro={erro} dica="DDD + número. Para outro país, comece com +.">
      <input
        id={id} name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" value={texto}
        onChange={(ev) => { setTexto(mascararWhatsapp(ev.target.value)); setErro(undefined) }}
        onBlur={() => setErro(normalizarWhatsapp(texto === '+' ? '' : texto).ok ? undefined : ERRO_WHATSAPP)}
        aria-invalid={erro ? true : undefined} aria-describedby={erro ? `${id}-erro` : undefined}
        className={classeCampo}
      />
    </Rotulado>
  )
}

export function CampoEmail({ valor, erros }: Base) {
  const [erro, setErro] = useState(erros?.[0])
  const id = `${useId()}-email`
  return (
    <Rotulado id={id} rotulo="E-mail" erro={erro}>
      <input
        id={id} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
        defaultValue={valor}
        onChange={() => setErro(undefined)}
        onBlur={(ev) => {
          const v = ev.target.value.trim().toLowerCase()
          setErro(v === '' || z.email().safeParse(v).success ? undefined : ERRO_EMAIL)
        }}
        aria-invalid={erro ? true : undefined} aria-describedby={erro ? `${id}-erro` : undefined}
        className={classeCampo}
      />
    </Rotulado>
  )
}

// R126: in Brazil the state is picked from the 27 UFs; in any other country it is typed.
export function CamposLocal({ pais, estado, cidade, erros }: { pais: string; estado: string; cidade: string; erros: (c: string) => string[] | undefined }) {
  const [paisAtual, setPaisAtual] = useState(pais)
  const brasil = ehBrasil(paisAtual)
  const id = useId()
  return (
    <>
      <Rotulado id={`${id}-pais`} rotulo="País" erro={erros('pais')?.[0]}>
        <input id={`${id}-pais`} name="pais" value={paisAtual} onChange={(ev) => setPaisAtual(ev.target.value)} autoComplete="country-name" maxLength={60} className={classeCampo} />
      </Rotulado>
      <Rotulado id={`${id}-estado`} rotulo="Estado" erro={erros('estado')?.[0]}>
        {brasil ? (
          <select key="uf" id={`${id}-estado`} name="estado" defaultValue={estado.toUpperCase()} className={classeCampo}>
            <option value="">Não informado</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        ) : (
          <input key="texto" id={`${id}-estado`} name="estado" defaultValue={estado} maxLength={60} className={classeCampo} />
        )}
      </Rotulado>
      <Rotulado id={`${id}-cidade`} rotulo="Cidade" erro={erros('cidade')?.[0]}>
        <input id={`${id}-cidade`} name="cidade" defaultValue={cidade} autoComplete="address-level2" maxLength={120} className={classeCampo} />
      </Rotulado>
    </>
  )
}
