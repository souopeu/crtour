'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { BotaoEnviar } from '@/components/auth/BotaoEnviar'
import { Campo } from '@/components/auth/Campo'
import { Mensagem } from '@/components/auth/Mensagem'
import type { ValoresCliente } from '@/lib/clientes/formulario'
import type { EstadoForm } from '@/lib/forms'

type Props = {
  acao: (estado: EstadoForm, fd: FormData) => Promise<EstadoForm>
  inicial: ValoresCliente
  rotuloBotao: string
}

const classeCampo = 'rounded-xl border border-controle bg-superficie px-3 text-base'

export function ClienteForm({ acao, inicial, rotuloBotao }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(acao, {})
  const v = (estado.valores as ValoresCliente | undefined) ?? inicial
  const e = (c: string) => estado.campos?.[c]

  return (
    <form key={estado.versao ?? 'inicial'} action={enviar} className="flex max-w-xl flex-col gap-4">
      <Mensagem estado={estado} />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">Contato</legend>
        <Campo nome="nome" rotulo="Nome" valor={v.nome} erros={e('nome')} autoComplete="off" />
        <Campo nome="whatsapp" rotulo="WhatsApp" tipo="tel" valor={v.whatsapp} erros={e('whatsapp')} dica="DDD + número. Para outro país, comece com +." />
        <Campo nome="email" rotulo="E-mail" tipo="email" valor={v.email} erros={e('email')} />
        <Campo nome="cidade" rotulo="Cidade" valor={v.cidade} erros={e('cidade')} />
        <Campo nome="aniversario" rotulo="Aniversário" tipo="date" valor={v.aniversario} erros={e('aniversario')} />
        <div className="flex flex-col gap-1">
          <label htmlFor="origem" className="text-sm font-medium">Como conheceu a agência</label>
          <select id="origem" name="origem" defaultValue={v.origem} className={`h-12 ${classeCampo}`}>
            <option value="">Não informada</option>
            <option value="instagram">Instagram</option>
            <option value="indicacao">Indicação</option>
            <option value="anuncio">Anúncio</option>
            <option value="site">Site</option>
            <option value="outro">Outro</option>
          </select>
          {e('origem')?.length ? <p role="alert" className="text-sm text-despesa">{e('origem')![0]}</p> : null}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">Perfil de viagem</legend>
        <Campo nome="destinos" rotulo="Destinos de interesse" valor={v.destinos} erros={e('destinos')} dica="Separe por vírgula. Ex.: Lisboa, Fernando de Noronha" />
        <Campo nome="faixaOrcamento" rotulo="Faixa de orçamento" valor={v.faixaOrcamento} erros={e('faixaOrcamento')} />
        <Campo nome="qtdPessoas" rotulo="Número de pessoas" tipo="number" valor={v.qtdPessoas} erros={e('qtdPessoas')} />
        <div className="flex flex-col gap-1">
          <label htmlFor="restricoes" className="text-sm font-medium">Restrições e observações</label>
          <textarea id="restricoes" name="restricoes" rows={3} defaultValue={v.restricoes} className={`py-2 ${classeCampo}`} />
          {e('restricoes')?.length ? <p role="alert" className="text-sm text-despesa">{e('restricoes')![0]}</p> : null}
        </div>
        <Campo nome="passaporteValidade" rotulo="Validade do passaporte" tipo="date" valor={v.passaporteValidade} erros={e('passaporteValidade')} dica="Guardamos só a validade, nunca o número." />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">Mensagens no WhatsApp</legend>
        <div className="flex flex-col gap-1">
          <label htmlFor="consentimento" className="text-sm font-medium">Consentimento</label>
          <select id="consentimento" name="consentimento" defaultValue={v.consentimento} className={`h-12 ${classeCampo}`}>
            <option value="nao_informado">Não informado</option>
            <option value="aceitou">Aceitou receber mensagens</option>
            <option value="pediu_saida">Pediu para não receber</option>
          </select>
          <p className="text-sm text-tinta-suave">Só envie promoções a quem aceitou.</p>
          {e('consentimento')?.length ? <p role="alert" className="text-sm text-despesa">{e('consentimento')![0]}</p> : null}
        </div>
      </fieldset>

      <div className="flex items-center gap-4">
        <BotaoEnviar>{rotuloBotao}</BotaoEnviar>
        <Link href="/" className="text-sm text-primaria underline">Voltar</Link>
      </div>
    </form>
  )
}
