import Link from 'next/link'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { FormSobMedida } from '@/components/reservas/FormSobMedida'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { botaoSecundario, campoBarra, cartaoFiltros } from '@/components/tela/estilos'
import { hojeNoBrasil } from '@/lib/formato'
import { buscarClientesParaReserva, buscarNomeDoCliente } from '@/lib/passeios/dados'

export const metadata = { title: 'Nova reserva' }

const um = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

async function SobMedida({ searchParams }: Pick<PageProps<'/reservas/nova'>, 'searchParams'>) {
  const sp = await searchParams // the request first: "today" below is per request
  const busca = um(sp.busca).trim().slice(0, 100)
  const clienteId = um(sp.cliente)
  const [resultados, nome] = await Promise.all([
    busca ? buscarClientesParaReserva(busca) : Promise.resolve([]),
    clienteId ? buscarNomeDoCliente(clienteId) : Promise.resolve(null),
  ])
  if (nome) {
    return (
      <>
        <p>Para <strong>{nome}</strong>. <Link href={busca ? `/reservas/nova?busca=${encodeURIComponent(busca)}` : '/reservas/nova'} className="text-primaria underline">Escolher outro cliente</Link></p>
        <FormSobMedida clienteId={clienteId} hoje={hojeNoBrasil()} />
      </>
    )
  }
  return (
    <>
      <form method="get" action="/reservas/nova" role="search" className="flex flex-col gap-2">
        <label htmlFor="busca-cliente" className="text-sm font-medium">Buscar cliente (nome, e-mail ou telefone)</label>
        <div className="flex gap-2">
          <input id="busca-cliente" name="busca" type="search" defaultValue={busca} maxLength={100} className={`${campoBarra} h-12 min-w-0 flex-1`} />
          <button type="submit" className={botaoSecundario}>Buscar</button>
        </div>
      </form>
      {busca && resultados.length === 0 && <p className="text-sm text-tinta-suave">Nenhum cliente encontrado. <Link href="/clientes/novo" className="text-primaria underline">Cadastrar novo cliente</Link></p>}
      {resultados.length > 0 && (
        <ul className="flex flex-col gap-2">
          {resultados.map((c) => (
            <li key={c.id}>
              <Link href={`/reservas/nova?${new URLSearchParams({ busca, cliente: c.id })}`} className="flex min-h-12 items-center justify-between gap-3 rounded-(--radius-cartao) border border-linha bg-superficie p-3">
                <span className="font-semibold">{c.nome}</span>
                <span className="text-sm text-tinta-suave">{c.cidade ?? ''} · Escolher</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default function NovaReservaPage({ searchParams }: PageProps<'/reservas/nova'>) {
  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6">
      <CabecalhoPagina area="Reservas" titulo="Nova reserva" descricao="Em uma saída de passeio do catálogo, ou um serviço sob medida." />
      <div className={cartaoFiltros}>
        <h2 className="text-lg font-semibold">Em uma saída de passeio</h2>
        <p className="text-sm text-tinta-suave">Escolha o passeio e a saída; a reserva respeita as vagas e o preço da saída.</p>
        <Link href="/passeios" className={`${botaoSecundario} w-fit`}>Ver passeios e saídas</Link>
      </div>
      <section aria-labelledby="sob-medida-titulo" className={cartaoFiltros}>
        <h2 id="sob-medida-titulo" className="text-lg font-semibold">Serviço sob medida</h2>
        <p className="text-sm text-tinta-suave">Transfer, passeio privativo ou outro serviço fora do catálogo. Vira uma reserva como as outras: entra em Saídas do dia, no embarque, nas cobranças e nos relatórios. Não aparece na lista de passeios.</p>
        <Suspense fallback={<Carregando altura="h-24" />}>
          <SobMedida searchParams={searchParams} />
        </Suspense>
      </section>
    </section>
  )
}
