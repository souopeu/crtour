'use client'

import { useActionState } from 'react'
import { alternarAtividade, apagarAtividade, criarAtividade } from '@/app/(app)/atividades/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Campo } from '@/components/auth/Campo'
import { Mensagem } from '@/components/auth/Mensagem'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import type { EstadoForm } from '@/lib/forms'
import { TIPOS, rotuloDoTipo, type StatusAtividade, type TipoAtividade } from '@/lib/atividades/atividades'

export type AtividadeView = {
  id: string; tipo: TipoAtividade; titulo: string; quando: string; status: StatusAtividade; responsavel: string | null
  negociacao: string | null; motivo: string | null; atrasada: boolean; podeApagar: boolean
}
type Props = {
  clienteId: string
  atividades: AtividadeView[]
  agoraLocal: string
  responsaveis: { user_id: string; nome: string }[]
  negociacoes: { id: string; titulo: string }[]
}

const select = 'h-12 rounded-xl border border-controle bg-superficie px-3 text-base'

export function AtividadesCliente({ clienteId, atividades, agoraLocal, responsaveis, negociacoes }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(criarAtividade.bind(null, clienteId), {})
  const v = estado.valores ?? { tipo: 'ligacao', titulo: '', quando: agoraLocal, status: 'pendente', responsavel: '', negociacao: '', motivo: '' }
  const e = (c: string) => estado.campos?.[c]
  const pendentes = atividades.filter((a) => a.status === 'pendente')
  const feitas = atividades.filter((a) => a.status === 'feito')

  const Linha = ({ a }: { a: AtividadeView }) => (
    <li className="flex flex-col gap-1 rounded-[--radius-cartao] border border-linha bg-superficie p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{rotuloDoTipo(a.tipo)}: {a.titulo}</span>
        <span className={`text-sm ${a.atrasada ? 'font-semibold text-despesa' : 'text-tinta-suave'}`}>{a.quando}{a.atrasada ? ' · atrasada' : ''}</span>
      </div>
      {a.motivo && <p className="text-sm text-tinta-suave">Por quê: {a.motivo}</p>}
      {(a.responsavel || a.negociacao) && (
        <p className="text-sm text-tinta-suave">{[a.responsavel && `Responsável: ${a.responsavel}`, a.negociacao && `Negociação: ${a.negociacao}`].filter(Boolean).join(' · ')}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <form action={alternarAtividade.bind(null, clienteId, a.id, a.status === 'feito' ? 'pendente' : 'feito')}>
          <button type="submit" className="min-h-11 text-primaria underline">{a.status === 'feito' ? 'Desfazer (voltar para pendente)' : 'Marcar como feita'}</button>
        </form>
        {a.podeApagar && (
          <ConfirmarExclusao acao={apagarAtividade.bind(null, clienteId, a.id)} rotulo="Apagar atividade" aviso={`Apaga "${a.titulo}". Se ela estava feita, a última interação do cliente é recalculada.`} rotuloConfirmar="Apagar mesmo" />
        )}
      </div>
    </li>
  )

  return (
    <section aria-labelledby="atividades-titulo" className="flex w-full flex-col gap-3">
      <h2 id="atividades-titulo" className="text-lg font-semibold">Atividades</h2>
      <form key={estado.versao ?? 'inicial'} action={enviar} className="flex flex-col gap-3 rounded-[--radius-cartao] border border-linha p-3">
        <Mensagem estado={estado} />
        <div className="flex flex-col gap-1">
          <label htmlFor="atv-tipo" className="text-sm font-medium">Tipo</label>
          <select id="atv-tipo" name="tipo" defaultValue={v.tipo} className={select}>
            {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
          </select>
        </div>
        <Campo nome="titulo" id="atv-titulo" rotulo="O que fazer ou o que foi feito" valor={v.titulo} erros={e('titulo')} autoComplete="off" />
        <Campo nome="motivo" id="atv-motivo" rotulo="Por quê (opcional)" valor={v.motivo} erros={e('motivo')} autoComplete="off" />
        <Campo nome="quando" id="atv-quando" rotulo="Data e hora" tipo="datetime-local" valor={v.quando} erros={e('quando')} />
        <div className="flex flex-col gap-1">
          <label htmlFor="atv-status" className="text-sm font-medium">Situação</label>
          <select id="atv-status" name="status" defaultValue={v.status} className={select}>
            <option value="pendente">Pendente (agendar)</option>
            <option value="feito">Já foi feita (registrar)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="atv-responsavel" className="text-sm font-medium">Responsável</label>
          <select id="atv-responsavel" name="responsavel" defaultValue={v.responsavel} className={select}>
            <option value="">Sem responsável</option>
            {responsaveis.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
          </select>
        </div>
        {negociacoes.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="atv-negociacao" className="text-sm font-medium">Negociação (opcional)</label>
            <select id="atv-negociacao" name="negociacao" defaultValue={v.negociacao} className={select}>
              <option value="">Nenhuma</option>
              {negociacoes.map((n) => <option key={n.id} value={n.id}>{n.titulo}</option>)}
            </select>
          </div>
        )}
        <div><BotaoEnviar>Salvar atividade</BotaoEnviar></div>
      </form>

      {atividades.length === 0 ? (
        <p className="text-sm text-tinta-suave">Nenhuma atividade ainda.</p>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-tinta-suave">A fazer</h3>
              <ul className="flex flex-col gap-2">{pendentes.map((a) => <Linha key={a.id} a={a} />)}</ul>
            </div>
          )}
          {feitas.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-tinta-suave">Feitas</h3>
              <ul className="flex flex-col gap-2">{feitas.map((a) => <Linha key={a.id} a={a} />)}</ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
