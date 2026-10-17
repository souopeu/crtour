import { Suspense } from 'react'
import { NavPrincipal } from '@/components/NavPrincipal'
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
  const avisosNovos = membro.papel === 'dono' ? await contarAvisosNaoLidos() : 0
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex min-h-14 items-center justify-between bg-[#1d4ed8] px-4 text-white print:hidden">
        <span className="text-xl font-extrabold tracking-tight text-destaque">{APP_NAME}</span>
        <div className="flex items-center gap-3 text-sm">
          <NavPrincipal itens={[
            { href: '/hoje', rotulo: 'Hoje' },
            { href: '/', rotulo: 'Clientes' },
            { href: '/funil', rotulo: 'Funil' },
            { href: '/remarketing', rotulo: 'Remarketing' },
            { href: '/passeios', rotulo: 'Passeios' },
            { href: '/cobrancas', rotulo: 'Cobranças' },
            { href: '/painel', rotulo: 'Painel' },
            ...(membro.papel === 'dono' ? [{ href: '/avisos', rotulo: 'Avisos', novos: avisosNovos }] : []),
            { href: '/configuracoes', rotulo: 'Configurações' },
          ]} />
          <span className="hidden xl:inline">{usuario.email}</span>
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
