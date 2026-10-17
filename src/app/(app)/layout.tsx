import { Suspense } from 'react'
import Link from 'next/link'
import { sair } from '@/app/(auth)/actions'
import { APP_NAME } from '@/lib/brand'
import { exigirUsuario } from '@/lib/auth/usuario'

function Carregando() {
  return <div aria-busy="true" aria-label="Carregando" className="min-h-screen bg-papel" />
}

async function Casca({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex min-h-14 items-center justify-between bg-[#1d4ed8] px-4 text-white print:hidden">
        <span className="text-xl font-extrabold tracking-tight text-destaque">{APP_NAME}</span>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/" className="inline-flex min-h-11 items-center underline">Clientes</Link>
          <Link href="/passeios" className="inline-flex min-h-11 items-center underline">Passeios</Link>
          <Link href="/cobrancas" className="inline-flex min-h-11 items-center underline">Cobranças</Link>
          <Link href="/configuracoes" className="inline-flex min-h-11 items-center underline">Configurações</Link>
          <span className="hidden sm:inline">{usuario.email}</span>
          <form action={sair}>
            <button type="submit" className="min-h-11 rounded-full border border-white/40 px-4">Sair</button>
          </form>
        </div>
      </header>
      <div className="flex-1 p-4">{children}</div>
    </div>
  )
}

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <Suspense fallback={<Carregando />}>
      <Casca>{children}</Casca>
    </Suspense>
  )
}
