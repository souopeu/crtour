import { Suspense } from 'react'
import { FormLogin } from '@/components/auth/FormLogin'
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
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Entrar</h1>
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  )
}
