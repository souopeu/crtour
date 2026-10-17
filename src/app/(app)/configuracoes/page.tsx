import { Suspense } from 'react'
import { FormExcluirConta } from '@/components/FormExcluirConta'
import { getMembro } from '@/lib/auth/agencia'

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

const link = 'inline-flex min-h-11 items-center text-primaria underline'

export default function ConfiguracoesPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>

      <section aria-labelledby="exportar-titulo" className="flex flex-col gap-2">
        <h2 id="exportar-titulo" className="text-lg font-semibold">Exportar seus dados</h2>
        <p className="max-w-prose text-sm text-tinta-suave">
          Baixe tudo em planilha (CSV). O arquivo de clientes pode ser importado de volta.
        </p>
        <a href="/exportar?tipo=clientes" className={link}>Baixar clientes (.csv)</a>
        <a href="/exportar?tipo=anotacoes" className={link}>Baixar anotações (.csv)</a>
      </section>

      <section aria-labelledby="excluir-titulo" className="flex flex-col gap-3">
        <h2 id="excluir-titulo" className="text-lg font-semibold">Excluir conta</h2>
        <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-24" />}>
          <ExcluirConta />
        </Suspense>
      </section>
    </div>
  )
}
