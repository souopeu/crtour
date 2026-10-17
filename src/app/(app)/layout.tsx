import { Suspense } from 'react'
import Link from 'next/link'
import { sair } from '@/app/(auth)/actions'
import { APP_NAME } from '@/lib/brand'
import { getMembro } from '@/lib/auth/agencia'
import { exigirUsuario } from '@/lib/auth/usuario'
import { contarAvisosNaoLidos } from '@/lib/negociacoes/dados'

function Carregando() {
  return <div aria-busy="true" aria-label="Carregando" className="min-h-screen bg-papel" />
}

// Logged in but not in any agency (e.g. a removed seller): no data, just a way out.
function SemAgencia({ email }: { email: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Sem acesso a uma agência</h1>
      <p>A conta {email} não faz parte de nenhuma agência no momento. Se isso for um engano, fale com o dono da agência.</p>
      <form action={sair}>
        <button type="submit" className="min-h-11 rounded-full border border-controle px-4">Sair</button>
      </form>
    </main>
  )
}

async function Casca({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario()
  const membro = await getMembro()
  if (!membro) return <SemAgencia email={usuario.email ?? ''} />
  const avisosNovos = membro?.papel === 'dono' ? await contarAvisosNaoLidos() : 0
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex min-h-14 items-center justify-between bg-[#1d4ed8] px-4 text-white print:hidden">
        <span className="text-xl font-extrabold tracking-tight text-destaque">{APP_NAME}</span>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/hoje" className="inline-flex min-h-11 items-center underline">Hoje</Link>
          <Link href="/" className="inline-flex min-h-11 items-center underline">Clientes</Link>
          <Link href="/funil" className="inline-flex min-h-11 items-center underline">Funil</Link>
          <Link href="/remarketing" className="inline-flex min-h-11 items-center underline">Remarketing</Link>
          <Link href="/passeios" className="inline-flex min-h-11 items-center underline">Passeios</Link>
          <Link href="/cobrancas" className="inline-flex min-h-11 items-center underline">Cobranças</Link>
          <Link href="/painel" className="inline-flex min-h-11 items-center underline">Painel</Link>
          {membro?.papel === 'dono' && (
            <Link href="/avisos" className="inline-flex min-h-11 items-center underline">
              Avisos{avisosNovos > 0 && <span className="ml-1 rounded-full bg-destaque px-2 text-xs font-bold text-destaque-texto" aria-label={`${avisosNovos} novos`}>{avisosNovos}</span>}
            </Link>
          )}
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
