import { FormRecuperar } from '@/components/auth/FormRecuperar'

export const metadata = { title: 'Recuperar senha' }

export default function RecuperarPage() {
  return (
    <>
      <h1 className="mb-1 text-[1.75rem] font-medium tracking-tight">Recuperar senha</h1>
      <p className="mb-4 text-sm text-tinta-suave">Digite seu e-mail e enviaremos um link para criar uma nova senha.</p>
      <FormRecuperar />
    </>
  )
}
