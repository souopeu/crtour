'use client'

import { useActionState, useState } from 'react'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'
import { TIPOS_PERGUNTA } from '@/lib/perguntas/perguntas'

type Acao = (e: EstadoForm, fd: FormData) => Promise<EstadoForm>
const campo = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

function Erro({ id, texto }: { id: string; texto?: string }) {
  return texto ? <p id={id} role="alert" className="text-sm text-despesa">{texto}</p> : null
}

function CamposNova({ v, erros }: { v: Record<string, string>; erros: EstadoForm['campos'] }) {
  const [tipo, setTipo] = useState(v.tipo ?? 'texto')
  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor="pergunta-texto" className="text-sm font-medium">Pergunta</label>
        <input id="pergunta-texto" name="texto" defaultValue={v.texto} maxLength={200} placeholder="Ex.: Hotel para busca"
          aria-invalid={erros?.texto ? true : undefined} aria-describedby="pergunta-texto-erro" className={campo} />
        <Erro id="pergunta-texto-erro" texto={erros?.texto?.[0]} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="pergunta-tipo" className="text-sm font-medium">Tipo de resposta</label>
        <select id="pergunta-tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
          {Object.entries(TIPOS_PERGUNTA).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select>
      </div>
      {tipo === 'escolha' && (
        <div className="flex flex-col gap-1">
          <label htmlFor="pergunta-opcoes" className="text-sm font-medium">Opções (uma por linha)</label>
          <textarea id="pergunta-opcoes" name="opcoes" rows={3} defaultValue={v.opcoes} aria-invalid={erros?.opcoes ? true : undefined}
            aria-describedby="pergunta-opcoes-erro" className="rounded-xl border border-controle bg-superficie px-3 py-2 text-base" />
          <Erro id="pergunta-opcoes-erro" texto={erros?.opcoes?.[0]} />
        </div>
      )}
      <label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" name="obrigatoria" value="1" defaultChecked={v.obrigatoria === '1'} /> Obrigatória</label>
      <label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" name="por_passageiro" value="1" defaultChecked={v.por_passageiro === '1'} /> Uma resposta por passageiro</label>
    </>
  )
}

export function NovaPergunta({ acao }: { acao: Acao }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  return (
    <form action={enviar} aria-label="Nova pergunta" className="flex max-w-xl flex-col gap-3">
      <Mensagem estado={estado} />
      <CamposNova key={estado.versao ?? 'inicial'} v={estado.valores ?? {}} erros={estado.campos} />
      <div><BotaoEnviar>Incluir pergunta</BotaoEnviar></div>
    </form>
  )
}

// Inline edit of the text and "required" (type and options stay, the answers already given follow them).
export function EditarPergunta({ acao, texto, obrigatoria, rotulo }: { acao: Acao; texto: string; obrigatoria: boolean; rotulo: string }) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const v = estado.valores ?? { texto, obrigatoria: obrigatoria ? '1' : '' }
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex flex-col gap-2">
      <Mensagem estado={estado} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`editar-${rotulo}`}>Texto da pergunta {rotulo}</label>
        <input id={`editar-${rotulo}`} name="texto" defaultValue={v.texto} maxLength={200} className={`${campo} min-w-0 flex-1`} />
        <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="obrigatoria" value="1" defaultChecked={v.obrigatoria === '1'} /> Obrigatória</label>
        <button type="submit" className="min-h-11 text-sm text-primaria underline">Salvar<span className="sr-only"> pergunta {rotulo}</span></button>
      </div>
      <Erro id={`editar-${rotulo}-erro`} texto={estado.campos?.texto?.[0]} />
    </form>
  )
}
