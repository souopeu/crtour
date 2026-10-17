import { Suspense } from 'react'
import { FormLogin } from '@/components/auth/FormLogin'
import { proximoSeguro } from '@/lib/auth/redirect'

export const metadata = { title: 'Entrar' }

async function Conteudo({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const { next, erro } = await searchParams
  return (
    <>
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
      <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  )
}
