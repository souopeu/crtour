import Link from 'next/link'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { ConversaAberta } from '@/components/atendimento/ConversaAberta'
import { ListaConversas } from '@/components/atendimento/ListaConversas'
import { lerFiltrosAtendimento } from '@/lib/atendimento/atendimento'
import { buscarConversa, contarConversas, listarConversas, temCanalWhatsapp } from '@/lib/atendimento/dados'
import { getMembro } from '@/lib/auth/agencia'
import { listarEtiquetas } from '@/lib/clientes/dados'
import { listarMembros } from '@/lib/negociacoes/dados'

export const metadata = { title: 'Atendimento' }

// R107: without a connected WhatsApp number the inbox is just a notice.
function SemWhatsapp() {
  return (
    <section className="flex flex-col gap-2 rounded-(--radius-cartao) border border-linha bg-superficie p-4">
      <h2 className="text-lg font-semibold">WhatsApp ainda não conectado</h2>
      <p className="text-sm text-tinta-suave">
        A caixa de atendimento aparece quando o número da agência estiver ligado ao crTOUR pela API oficial do WhatsApp.
        Até lá, as conversas continuam no WhatsApp do celular.
      </p>
      <Link href="/configuracoes" className="text-sm text-primaria underline">Ir para Configurações</Link>
    </section>
  )
}

async function Conteudo({ searchParams }: Pick<PageProps<'/atendimento'>, 'searchParams'>) {
  const [sp, membro, canal] = await Promise.all([searchParams, getMembro(), temCanalWhatsapp()])
  if (!membro) return null
  if (!canal) return <SemWhatsapp />
  const ehDono = membro.papel === 'dono'
  const filtros = lerFiltrosAtendimento(sp, ehDono)
  const [itens, naoLidas, etiquetas, membros, conversa] = await Promise.all([
    listarConversas(filtros), contarConversas(), listarEtiquetas(), listarMembros(), filtros.conversa ? buscarConversa(filtros.conversa) : Promise.resolve(null),
  ])
  const agora = new Date()
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className={filtros.conversa ? 'hidden lg:block' : ''}>
        <ListaConversas filtros={filtros} itens={itens} naoLidas={naoLidas} ehDono={ehDono} etiquetas={etiquetas} agora={agora} />
      </div>
      <div className={filtros.conversa ? '' : 'hidden lg:block'}>
        {conversa ? (
          <ConversaAberta conversa={conversa} filtros={filtros} membros={membros} meuId={membro.user_id} agora={agora} />
        ) : filtros.conversa ? (
          <p role="status" className="rounded-(--radius-cartao) border border-linha bg-superficie p-4 text-sm">Conversa não encontrada ou não está mais com você.</p>
        ) : (
          <p className="grid min-h-48 place-items-center rounded-(--radius-cartao) border border-dashed border-linha p-4 text-sm text-tinta-suave">Escolha um cliente para ver a conversa.</p>
        )}
      </div>
    </div>
  )
}

// Spec 19, R102–R108: the WhatsApp inbox (reading, taking, handing over, archiving; replying comes in Fatia 2c).
export default function AtendimentoPage({ searchParams }: PageProps<'/atendimento'>) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Atendimento</h1>
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
