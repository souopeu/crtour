'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { rodapeForm } from '@/components/tela/estilos'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Campo } from '@/components/auth/Campo'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'
import { ETAPAS, MOTIVOS, PROBABILIDADE_PADRAO } from '@/lib/negociacoes/negociacoes'

export type ValoresNegociacao = {
  titulo: string; valor: string; etapa: string; probabilidade: string; responsavel: string; dataEsperada: string; saida: string
  motivo: string; motivoTexto: string
}
type Props = {
  acao: (e: EstadoForm, fd: FormData) => Promise<EstadoForm>
  inicial: ValoresNegociacao
  rotuloBotao: string
  responsaveis: { user_id: string; nome: string }[]
  saidas: { id: string; rotulo: string }[]
  faixaEtapas?: boolean
}

const select = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

// Background of each arrow: stages up to the chosen one take their colour, like a progress bar (text says which is chosen).
const COR_ETAPA: Record<string, string> = {
  interessado: 'bg-etapa-interessado', orcamento: 'bg-etapa-orcamento', reservado: 'bg-etapa-reservado',
  pago: 'bg-etapa-pago', viajou: 'bg-etapa-viajou', pos_venda: 'bg-etapa-pos-venda',
}
const SETA = '[clip-path:polygon(0_0,calc(100%-0.75rem)_0,100%_50%,calc(100%-0.75rem)_100%,0_100%,0.75rem_50%)] first:[clip-path:polygon(0_0,calc(100%-0.75rem)_0,100%_50%,calc(100%-0.75rem)_100%,0_100%)]'

// R123: the stage strip of "Nova negociação" (arrows, as in the Bitrix print). The select below stays as the accessible fallback.
function FaixaEtapas({ etapa, escolher }: { etapa: string; escolher: (e: string) => void }) {
  const abertas = ETAPAS.filter((x) => x.valor !== 'perdido')
  const indice = abertas.findIndex((x) => x.valor === etapa)
  return (
    <div role="group" aria-label="Etapa inicial" className="-mx-1 flex overflow-x-auto pb-1">
      {abertas.map((x, i) => (
        <button
          key={x.valor}
          type="button"
          aria-pressed={x.valor === etapa}
          onClick={() => escolher(x.valor)}
          className={`-ml-1 min-h-11 min-w-28 flex-1 px-5 text-sm text-etapa-texto first:ml-0 ${SETA} ${i <= indice ? COR_ETAPA[x.valor] : 'bg-superficie-suave text-tinta-suave'} ${x.valor === etapa ? 'font-bold' : ''}`}
        >
          {x.valor === etapa ? `✓ ${x.rotulo}` : x.rotulo}
        </button>
      ))}
    </div>
  )
}

export function NegociacaoForm({ acao, inicial, rotuloBotao, responsaveis, saidas, faixaEtapas = false }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const v = (estado.valores as ValoresNegociacao | undefined) ?? inicial
  const [etapa, setEtapa] = useState(v.etapa)
  const [motivo, setMotivo] = useState(v.motivo)
  const e = (c: string) => estado.campos?.[c]
  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex max-w-xl flex-col gap-4">
      <Mensagem estado={estado} />
      {faixaEtapas && <FaixaEtapas etapa={etapa} escolher={setEtapa} />}
      <Campo nome="titulo" rotulo="Título" valor={v.titulo} erros={e('titulo')} dica="Ex.: Maria, Lisboa em março" autoComplete="off" />
      <Campo nome="valor" rotulo="Valor (R$)" valor={v.valor} erros={e('valor')} dica="Opcional. Ex.: 12.500,00" />
      <div className="flex flex-col gap-1">
        <label htmlFor="etapa" className="text-sm font-medium">Etapa</label>
        <select id="etapa" name="etapa" value={etapa} onChange={(ev) => setEtapa(ev.target.value)} className={select}>
          {ETAPAS.map((x) => <option key={x.valor} value={x.valor}>{x.rotulo}</option>)}
        </select>
        {e('etapa')?.[0] && <p role="alert" className="text-sm text-despesa">{e('etapa')![0]}</p>}
      </div>
      {etapa === 'perdido' && (
        <fieldset className="flex flex-col gap-3 rounded-xl border border-linha p-3">
          <legend className="px-1 text-sm font-medium">Por que perdeu?</legend>
          <div className="flex flex-col gap-1">
            <label htmlFor="motivo" className="text-sm font-medium">Motivo da perda</label>
            <select id="motivo" name="motivo" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} className={select}>
              <option value="">Escolha…</option>
              {MOTIVOS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
            </select>
            {e('motivo')?.[0] && <p role="alert" className="text-sm text-despesa">{e('motivo')![0]}</p>}
          </div>
          {motivo === 'outro' && <Campo nome="motivoTexto" rotulo="Descreva o motivo" valor={v.motivoTexto} erros={e('motivoTexto')} />}
        </fieldset>
      )}
      <Campo
        nome="probabilidade" rotulo="Probabilidade (%)" tipo="number" valor={v.probabilidade} erros={e('probabilidade')}
        dica={`Ao mudar de etapa, vale o padrão dela (${ETAPAS.filter((x) => x.valor !== 'perdido').map((x) => `${x.rotulo} ${PROBABILIDADE_PADRAO[x.valor]}%`).join(', ')}). O valor previsto é valor × probabilidade, calculado sozinho.`}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="responsavel" className="text-sm font-medium">Responsável</label>
        <select id="responsavel" name="responsavel" defaultValue={v.responsavel} className={select}>
          <option value="">Sem responsável</option>
          {responsaveis.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
        </select>
        {e('responsavel')?.[0] && <p role="alert" className="text-sm text-despesa">{e('responsavel')![0]}</p>}
      </div>
      <Campo nome="dataEsperada" rotulo="Data de fechamento esperada" tipo="date" valor={v.dataEsperada} erros={e('dataEsperada')} />
      <div className="flex flex-col gap-1">
        <label htmlFor="saida" className="text-sm font-medium">Saída (opcional)</label>
        <select id="saida" name="saida" defaultValue={v.saida} className={select}>
          <option value="">Nenhuma</option>
          {saidas.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
        </select>
        {e('saida')?.[0] && <p role="alert" className="text-sm text-despesa">{e('saida')![0]}</p>}
      </div>
      <div className={rodapeForm}>
        <BotaoEnviar>{rotuloBotao}</BotaoEnviar>
        <Link href="/funil" className="text-sm text-primaria underline">Voltar</Link>
      </div>
    </form>
  )
}
