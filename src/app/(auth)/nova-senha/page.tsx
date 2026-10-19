import { Suspense } from 'react'
import { FormNovaSenha } from '@/components/auth/FormNovaSenha'
import { exigirUsuario } from '@/lib/auth/usuario'
import { Carregando } from '@/components/Carregando'

export const metadata = { title: 'Nova senha' }

async function Conteudo() {
  await exigirUsuario()
  return <FormNovaSenha />
}

export default function NovaSenhaPage() {
  return (
    <>
      <h1 className="mb-4 text-[1.75rem] font-medium tracking-tight">Nova senha</h1>
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Conteudo />
      </Suspense>
    </>
  )
}
