import { Suspense } from 'react'
import { FormExcluirConta } from '@/components/FormExcluirConta'
import { FormLimites } from '@/components/FormLimites'
import { Equipe } from '@/components/equipe/Equipe'
import { getMembro } from '@/lib/auth/agencia'
import { buscarLimites } from '@/lib/hoje/dados'
import { Carregando } from '@/components/Carregando'

export const metadata = { title: 'Configurações' }

async function ExcluirConta() {
  const membro = await getMembro()
  if (membro?.papel !== 'dono') {
    return <p className="text-sm text-tinta-suave">Só o dono da agência pode excluir a conta.</p>
  }
  return (
    <>
      <p className="max-w-prose text-sm text-despesa">
        Apaga a agência, todos os clientes, etiquetas, anotações e importações, e remove o acesso de todos os usuários.
        Não dá para voltar atrás. Baixe seus dados antes.
      </p>
      <FormExcluirConta />
    </>
  )
}

async function Prazos() {
  const [membro, limites] = await Promise.all([getMembro(), buscarLimites()])
  if (membro?.papel !== 'dono') {
    return <p className="text-sm text-tinta-suave">Cliente sem contato depois de {limites.dias_sem_contato} dias; negociação parada depois de {limites.dias_negociacao_parada} dias. Só o dono muda estes prazos.</p>
  }
  return <FormLimites diasSemContato={limites.dias_sem_contato} diasParada={limites.dias_negociacao_parada} />
}

const link = 'inline-flex min-h-11 items-center text-primaria underline'

async function SecaoEquipe() {
  const membro = await getMembro()
  return membro ? <Equipe membro={membro} /> : null
}

// R41: only the owner exports the agency's data.
async function Exportar() {
  const membro = await getMembro()
  if (membro?.papel !== 'dono') return <p className="text-sm text-tinta-suave">Só o dono da agência baixa os dados.</p>
  return (
    <>
      <p className="max-w-prose text-sm text-tinta-suave">
        Baixe tudo em planilha (CSV): clientes, anotações, reservas, pagamentos e acompanhantes. O arquivo de clientes pode ser importado de volta.
      </p>
      <a href="/exportar?tipo=clientes" className={link}>Baixar clientes (.csv)</a>
      <a href="/exportar?tipo=anotacoes" className={link}>Baixar anotações (.csv)</a>
      <a href="/exportar?tipo=reservas" className={link}>Baixar reservas (.csv)</a>
      <a href="/exportar?tipo=pagamentos" className={link}>Baixar pagamentos (.csv)</a>
      <a href="/exportar?tipo=acompanhantes" className={link}>Baixar acompanhantes (.csv)</a>
    </>
  )
}

export default function ConfiguracoesPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>

      <section aria-labelledby="prazos-titulo" className="flex flex-col gap-2">
        <h2 id="prazos-titulo" className="text-lg font-semibold">Prazos da tela Hoje</h2>
        <Suspense fallback={<Carregando altura="h-24" />}>
          <Prazos />
        </Suspense>
      </section>

      <section aria-labelledby="equipe-titulo" className="flex flex-col gap-3">
        <h2 id="equipe-titulo" className="text-lg font-semibold">Equipe</h2>
        <Suspense fallback={<Carregando altura="h-24" />}>
          <SecaoEquipe />
        </Suspense>
      </section>

      <section aria-labelledby="exportar-titulo" className="flex flex-col gap-2">
        <h2 id="exportar-titulo" className="text-lg font-semibold">Exportar seus dados</h2>
        <Suspense fallback={<Carregando altura="h-24" />}>
          <Exportar />
        </Suspense>
      </section>

      <section aria-labelledby="excluir-titulo" className="flex flex-col gap-3">
        <h2 id="excluir-titulo" className="text-lg font-semibold">Excluir conta</h2>
        <Suspense fallback={<Carregando altura="h-24" />}>
          <ExcluirConta />
        </Suspense>
      </section>
    </div>
  )
}
