import { Suspense } from 'react'
import { FormLogin } from '@/components/auth/FormLogin'
import { IconeAuth } from '@/components/auth/IconesAuth'
import { proximoSeguro } from '@/lib/auth/redirect'
import { Carregando } from '@/components/Carregando'

export const metadata = { title: 'Entrar' }

async function Conteudo({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const { next, erro, conta } = await searchParams
  return (
    <>
      {conta === 'excluida' && (
        <p role="status" className="mb-4 rounded-xl bg-receita-suave p-3 text-sm text-receita">
          Sua conta e todos os dados foram excluídos.
        </p>
      )}
      {erro === 'link' && (
        <p role="alert" className="mb-4 rounded-xl bg-despesa-suave p-3 text-sm text-despesa">
          Esse link expirou ou já foi usado. Peça um novo ou entre com sua senha.
        </p>
      )}
      <FormLogin next={proximoSeguro(typeof next === 'string' ? next : null)} />
    </>
  )
}

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="inline-flex w-fit items-center gap-2 rounded-full bg-primaria-suave px-3 py-1 text-sm font-medium text-primaria">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-marca" />Área da sua agência
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight">Entrar</h1>
        <p className="text-tinta-suave">Use o e-mail e a senha da sua conta para abrir o painel da agência.</p>
      </div>
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
      <p className="flex items-center gap-2 border-t border-linha pt-4 text-sm text-tinta-suave">
        <IconeAuth nome="escudo" className="size-5 text-receita" />Conexão segura. Nunca pedimos sua senha por WhatsApp ou e-mail.
      </p>
    </div>
  )
}
