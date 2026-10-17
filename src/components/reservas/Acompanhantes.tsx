'use client'

import { useActionState } from 'react'
import { adicionarPassageiro, removerPassageiro } from '@/app/(app)/saidas/actions'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Campo } from '@/components/auth/Campo'
import { Mensagem } from '@/components/auth/Mensagem'
import type { EstadoForm } from '@/lib/forms'

type Props = {
  saidaId: string
  reservaId: string
  passageiros: { id: string; nome: string; telefone: string }[]
  lugaresLivres: number // places of the reservation still without a name
}

export function Acompanhantes({ saidaId, reservaId, passageiros, lugaresLivres }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(adicionarPassageiro.bind(null, saidaId, reservaId), {})
  const v = estado.valores ?? { nome: '', whatsapp: '' }
  return (
    <div className="flex flex-col gap-2 border-t border-linha pt-2">
      <p className="text-sm font-medium">Acompanhantes</p>
      {passageiros.length === 0 && <p className="text-sm text-tinta-suave">Nenhum nome informado ainda.</p>}
      {passageiros.length > 0 && (
        <ul className="flex flex-col gap-1">
          {passageiros.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{p.nome}{p.telefone && <span className="text-tinta-suave"> · {p.telefone}</span>}</span>
              <form action={removerPassageiro.bind(null, saidaId, p.id)}>
                <button type="submit" aria-label={`Remover ${p.nome}`} className="min-h-11 px-2 text-despesa underline">Remover</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {lugaresLivres > 0 ? (
        <form key={estado.versao ?? 'inicial'} action={enviar} className="flex flex-col gap-3">
          <Mensagem estado={estado} />
          <Campo nome="nome" id={`nome-${reservaId}`} rotulo={`Nome do acompanhante (${lugaresLivres} ${lugaresLivres === 1 ? 'lugar' : 'lugares'} sem nome)`} valor={v.nome} erros={estado.campos?.nome} autoComplete="off" />
          <Campo nome="whatsapp" id={`whatsapp-${reservaId}`} rotulo="WhatsApp (opcional)" tipo="tel" valor={v.whatsapp} erros={estado.campos?.whatsapp} />
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="cadastrar" className="size-5" />
            Cadastrar também como cliente (novo contato, sem consentimento de mensagens)
          </label>
          <div><BotaoEnviar>Adicionar acompanhante</BotaoEnviar></div>
        </form>
      ) : (
        <p className="text-sm text-tinta-suave">Todos os lugares desta reserva têm nome.</p>
      )}
    </div>
  )
}
