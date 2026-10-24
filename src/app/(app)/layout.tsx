import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { BuscaCelular } from '@/components/busca/BuscaCelular'
import { BuscaGlobal } from '@/components/busca/BuscaGlobal'
import { MenuCelular } from '@/components/menu/MenuCelular'
import { MenuLateral } from '@/components/menu/MenuLateral'
import { Sino } from '@/components/sino/Sino'
import { sair } from '@/app/(auth)/actions'
import { APP_NAME } from '@/lib/brand'
import Link from 'next/link'
import { getMembro, nomeDaAgencia } from '@/lib/auth/agencia'
import { exigirUsuario } from '@/lib/auth/usuario'
import { COOKIE_GRUPOS, COOKIE_LATERAL, VALOR_RECOLHIDA } from '@/lib/menu/config'
import { lerGruposFechados, montarMenu } from '@/lib/menu/menu'
import { contarAvisosNaoLidos } from '@/lib/negociacoes/dados'
import { canalWhatsapp, contarConversas } from '@/lib/atendimento/dados'

function Carregando() {
  return <div aria-busy="true" aria-label="Carregando" className="min-h-screen bg-fundo-app" />
}

// Logged in but not in any agency (e.g. a removed seller): no data, just a way out.
function SemAgencia({ email }: { email: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-[1.75rem] font-medium tracking-tight">Sem acesso a uma agência</h1>
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
  // R107: the inbox entry exists only with a WhatsApp number connected; its badge counts conversations with unread messages.
  const [avisosNovos, canal, contagem, agencia] = await Promise.all([
    contarAvisosNaoLidos(), canalWhatsapp(), contarConversas(), nomeDaAgencia(),
  ])
  const atendimento = canal ? [...contagem.entries()].filter(([aba]) => aba !== 'arquivadas').reduce((s, [, n]) => s + n, 0) : null
  const grupos = montarMenu(membro.papel, avisosNovos, atendimento)
  const jar = await cookies()
  const recolhido = jar.get(COOKIE_LATERAL)?.value === VALOR_RECOLHIDA
  const fechados = [...lerGruposFechados(jar.get(COOKIE_GRUPOS)?.value)]
  // R118: monday-like frame — light top bar across the screen, light sidebar, content on a white sheet.
  return (
    <div className="flex min-h-screen flex-col bg-fundo-app">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 bg-fundo-app px-4 print:hidden">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-marca">{APP_NAME}</Link>
        <BuscaGlobal className="mx-auto hidden w-full max-w-md lg:block" />
        <div className="ml-auto flex items-center gap-2 text-sm lg:ml-0">
          <BuscaCelular />
          <Sino naoLidosInicial={avisosNovos} />
          <span aria-hidden="true" title={usuario.email} className="hidden size-9 items-center justify-center rounded-full bg-marca font-bold text-white sm:inline-flex">
            {(membro.nome || usuario.email || '?').trim().charAt(0).toUpperCase()}
          </span>
          <MenuCelular grupos={grupos} fechadosIniciais={fechados} />
          <form action={sair}>
            <button type="submit" className="min-h-11 rounded-full border border-linha bg-superficie px-4 hover:bg-superficie-suave">Sair</button>
          </form>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <MenuLateral grupos={grupos} recolhidoInicial={recolhido} agencia={agencia} fechadosIniciais={fechados} />
        <div className="min-w-0 flex-1 border-linha bg-papel p-4 lg:rounded-tl-2xl lg:border-l lg:border-t lg:p-6 print:border-0 print:p-0">{children}</div>
      </div>
    </div>
  )
}
export default function AppLayout({ children, modal }: LayoutProps<'/'>) {
  return (
    <Suspense fallback={<Carregando />}>
      <Casca>{children}</Casca>
      {modal}
    </Suspense>
  )
}
