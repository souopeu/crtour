import Link from 'next/link'
import { Suspense } from 'react'
import { alternarAtividade } from '@/app/(app)/atividades/actions'
import { WhatsappRapido } from '@/components/hoje/WhatsappRapido'
import { getMembro } from '@/lib/auth/agencia'
import { rotuloDoTipo } from '@/lib/atividades/atividades'
import { formatarDataHora, hojeNoBrasil } from '@/lib/formato'
import { buscarLimites, listarPendentesAte, listarSemContato, type PendenteLinha } from '@/lib/hoje/dados'
import { diasDesde, estaParada, limiteSemContato, separarAtividades, textoHaDias } from '@/lib/hoje/hoje'
import { listarNegociacoes } from '@/lib/negociacoes/dados'
import { rotuloDaEtapa } from '@/lib/negociacoes/negociacoes'

export const metadata = { title: 'Hoje' }

const cartao = 'flex flex-col gap-2 rounded-[--radius-cartao] border border-linha bg-superficie p-3'
const vazio = 'text-sm text-tinta-suave'

function Titulo({ id, children, total }: { id: string; children: React.ReactNode; total: number }) {
  return <h2 id={id} className="text-lg font-semibold">{children} <span className="font-normal text-tinta-suave">({total})</span></h2>
}

function ListaAtividades({ itens, hoje, atrasadas }: { itens: PendenteLinha[]; hoje: string; atrasadas: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((a) => (
        <li key={a.id} className={cartao}>
          <p className="font-semibold">{a.titulo}</p>
          <p className="text-sm">
            {rotuloDoTipo(a.tipo)} · <Link href={`/clientes/${a.cliente.id}`} className="text-primaria underline">{a.cliente.nome}</Link> · {formatarDataHora(a.quando)}
            {a.responsavel_nome && <> · {a.responsavel_nome}</>}
          </p>
          {atrasadas && <p className="text-sm font-semibold text-despesa"><span aria-hidden="true">⚠ </span>Atrasada {textoHaDias(diasDesde(a.quando, hoje))}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <WhatsappRapido clienteId={a.cliente.id} nome={a.cliente.nome} whatsapp={a.cliente.whatsapp} consentimento={a.cliente.consentimento_whatsapp} />
            <form action={alternarAtividade.bind(null, a.cliente.id, a.id, 'feito')}>
              <button type="submit" aria-label={`Marcar como feita: ${a.titulo}`} className="min-h-11 rounded-full border border-controle bg-superficie px-4 text-sm font-semibold">Feito</button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  )
}

async function Conteudo() {
  const limites = await buscarLimites() // reads the session first, so "today" is computed per request
  const hoje = hojeNoBrasil()
  const [pendentes, semContato, negociacoes, membro] = await Promise.all([
    listarPendentesAte(limiteSemContato(hoje, 0)), // start of tomorrow = end of today
    listarSemContato(limiteSemContato(hoje, limites.dias_sem_contato)),
    listarNegociacoes(),
    getMembro(),
  ])
  const { atrasadas, deHoje } = separarAtividades(pendentes, hoje)
  const paradas = negociacoes
    .filter((n) => estaParada(n.etapa, n.etapa_desde, limites.dias_negociacao_parada, hoje))
    .sort((a, b) => Date.parse(a.etapa_desde) - Date.parse(b.etapa_desde))

  return (
    <>
      <p className="text-sm text-tinta-suave">
        Sem contato a partir de {limites.dias_sem_contato} dias; negociação parada depois de {limites.dias_negociacao_parada} dias na mesma etapa.{' '}
        {membro?.papel === 'dono' && <Link href="/configuracoes" className="text-primaria underline">Ajustar</Link>}
      </p>

      <section aria-labelledby="atrasadas-titulo" className="flex flex-col gap-2">
        <Titulo id="atrasadas-titulo" total={atrasadas.length}>Atrasadas</Titulo>
        {atrasadas.length === 0 ? <p className={vazio}>Nada atrasado.</p> : <ListaAtividades itens={atrasadas} hoje={hoje} atrasadas />}
      </section>

      <section aria-labelledby="dehoje-titulo" className="flex flex-col gap-2">
        <Titulo id="dehoje-titulo" total={deHoje.length}>Para hoje</Titulo>
        {deHoje.length === 0 ? <p className={vazio}>Nenhuma atividade marcada para hoje.</p> : <ListaAtividades itens={deHoje} hoje={hoje} atrasadas={false} />}
      </section>

      <section aria-labelledby="semcontato-titulo" className="flex flex-col gap-2">
        <Titulo id="semcontato-titulo" total={semContato.total}>Sem contato há {limites.dias_sem_contato} dias ou mais</Titulo>
        {semContato.clientes.length === 0 ? (
          <p className={vazio}>Todos os clientes tiveram contato recente.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {semContato.clientes.map((c) => (
              <li key={c.id} className={cartao}>
                <Link href={`/clientes/${c.id}`} className="font-semibold text-primaria underline">{c.nome}</Link>
                <p className="text-sm">
                  {c.ultima_interacao_em
                    ? `Último contato ${textoHaDias(diasDesde(c.ultima_interacao_em, hoje))}`
                    : `Nenhum contato registrado; cadastrado ${textoHaDias(diasDesde(c.criado_em, hoje))}`}
                </p>
                <WhatsappRapido clienteId={c.id} nome={c.nome} whatsapp={c.whatsapp} consentimento={c.consentimento_whatsapp} registrar />
              </li>
            ))}
          </ul>
        )}
        {semContato.total > semContato.clientes.length && (
          <p className={vazio}>Mostrando os {semContato.clientes.length} há mais tempo sem contato, de {semContato.total}.</p>
        )}
      </section>

      <section aria-labelledby="paradas-titulo" className="flex flex-col gap-2">
        <Titulo id="paradas-titulo" total={paradas.length}>Negociações paradas</Titulo>
        {paradas.length === 0 ? (
          <p className={vazio}>Nenhuma negociação parada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {paradas.map((n) => (
              <li key={n.id} className={cartao}>
                <Link href={`/negociacoes/${n.id}`} className="font-semibold text-primaria underline">{n.titulo}</Link>
                <p className="text-sm"><Link href={`/clientes/${n.cliente_id}`} className="underline">{n.cliente_nome}</Link>{n.responsavel_nome && <> · {n.responsavel_nome}</>}</p>
                <p className="text-sm font-semibold text-alerta"><span aria-hidden="true">⏸ </span>Parada em {rotuloDaEtapa(n.etapa)} {textoHaDias(diasDesde(n.etapa_desde, hoje))}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

export default function HojePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Hoje</h1>
      <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-64" />}>
        <Conteudo />
      </Suspense>
    </div>
  )
}
