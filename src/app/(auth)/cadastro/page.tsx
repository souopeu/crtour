import { FormCadastro } from '@/components/auth/FormCadastro'

export const metadata = { title: 'Criar conta' }

export default function CadastroPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Criar conta</h1>
      <FormCadastro />
    </>
  )
}
