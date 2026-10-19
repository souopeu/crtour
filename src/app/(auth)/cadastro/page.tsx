import { Suspense } from 'react'
import { FormCadastro } from '@/components/auth/FormCadastro'
import { Carregando } from '@/components/Carregando'

export const metadata = { title: 'Criar conta' }

const um = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

async function Conteudo({ searchParams }: Pick<PageProps<'/cadastro'>, 'searchParams'>) {
  const sp = await searchParams
  const token = um(sp.convite)
  if (!token) {
    return (
      <>
        <h1 className="mb-4 text-[1.75rem] font-medium tracking-tight">Criar conta</h1>
        <FormCadastro />
      </>
    )
  }
  return (
    <>
      <h1 className="mb-2 text-[1.75rem] font-medium tracking-tight">Entrar na equipe</h1>
      <p className="mb-4 text-sm text-tinta-suave">Você foi convidada(o) para usar o crTOUR com a sua agência. Crie seu acesso com o e-mail do convite.</p>
      <FormCadastro convite={{ token, email: um(sp.email).slice(0, 254) }} />
    </>
  )
}

export default function CadastroPage({ searchParams }: PageProps<'/cadastro'>) {
  return (
    <Suspense fallback={<Carregando altura="h-96" />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  )
}
