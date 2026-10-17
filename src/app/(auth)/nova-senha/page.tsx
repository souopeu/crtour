import { Suspense } from 'react'
import { FormNovaSenha } from '@/components/auth/FormNovaSenha'
import { exigirUsuario } from '@/lib/auth/usuario'

export const metadata = { title: 'Nova senha' }

async function Conteudo() {
  await exigirUsuario()
  return <FormNovaSenha />
}

export default function NovaSenhaPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Nova senha</h1>
      <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-40" />}>
        <Conteudo />
      </Suspense>
    </>
  )
}
