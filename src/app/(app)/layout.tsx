import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { BuscaCelular } from '@/components/busca/BuscaCelular'
import { BuscaGlobal } from '@/components/busca/BuscaGlobal'
import { MenuCelular } from '@/components/menu/MenuCelular'
import { MenuLateral } from '@/components/menu/MenuLateral'
import { sair } from '@/app/(auth)/actions'
import { APP_NAME } from '@/lib/brand'
import { getMembro } from '@/lib/auth/agencia'
import { exigirUsuario } from '@/lib/auth/usuario'
import { COOKIE_LATERAL, VALOR_RECOLHIDA } from '@/lib/menu/config'
import { montarMenu } from '@/lib/menu/menu'
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
  const avisosNovos = membro.papel === 'dono' ? await contarAvisosNaoLidos() : 0
  const grupos = montarMenu(membro.papel, avisosNovos)
  const recolhido = (await cookies()).get(COOKIE_LATERAL)?.value === VALOR_RECOLHIDA
  const botaoSair = (classe: string) => (
    <form action={sair}>
      <button type="submit" className={`min-h-11 rounded-full px-4 ${classe}`}>Sair</button>
    </form>
  )
  return (
    <div className="flex min-h-screen">
      <MenuLateral grupos={grupos} recolhidoInicial={recolhido} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center justify-between bg-marca px-4 text-white lg:hidden print:hidden">
          <span className="text-xl font-extrabold tracking-tight text-destaque">{APP_NAME}</span>
          <div className="flex items-center gap-2 text-sm">
            <BuscaCelular />
            <MenuCelular grupos={grupos} />
            {botaoSair('border border-white/40')}
          </div>
        </header>
        <div className="hidden min-h-14 items-center justify-between gap-3 border-b border-linha bg-superficie px-4 text-sm lg:flex print:hidden">
          <BuscaGlobal className="w-full max-w-md" />
          <div className="flex items-center gap-3">
            <span className="text-tinta-suave">{usuario.email}</span>
            {botaoSair('border border-controle')}
          </div>
        </div>
        <div className="flex-1 p-4">{children}</div>
      </div>
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
