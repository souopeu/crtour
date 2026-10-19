import Link from 'next/link'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { FormImportarReservas } from '@/components/importacao/FormImportarReservas'
import { ImportacoesReservasAnteriores } from '@/components/importacao/ImportacoesReservasAnteriores'
import { listarImportacoesReservas } from '@/lib/importacao/dadosReservas'
import { formatarDataHora } from '@/lib/formato'

export const metadata = { title: 'Importar reservas' }

async function Anteriores() {
  const lista = await listarImportacoesReservas()
  return <ImportacoesReservasAnteriores importacoes={lista.map((i) => ({ id: i.id, nome: i.nome, quando: formatarDataHora(i.criada_em), criadas: i.qtd_criadas, recusadas: i.qtd_recusadas }))} />
}

export default function ImportarReservasPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-[1.75rem] font-medium tracking-tight">Importar reservas</h1>
        <p className="mt-1 text-tinta-suave">
          Traga as reservas da sua planilha. Os clientes, os passeios e as saídas precisam já estar cadastrados: a planilha não cria nada disso.
          As vagas são respeitadas, e você confere tudo antes de importar.
        </p>
        <a href="/importar/reservas/modelo" className="mt-3 inline-flex min-h-11 items-center text-primaria underline">Baixar planilha-modelo de reservas (.xlsx)</a>
      </div>
      <FormImportarReservas />
      <section aria-labelledby="anteriores-reservas-titulo" className="flex flex-col gap-2">
        <h2 id="anteriores-reservas-titulo" className="text-lg font-semibold">Importações anteriores</h2>
        <Suspense fallback={<Carregando altura="h-20" />}>
          <Anteriores />
        </Suspense>
      </section>
      <Link href="/importar" className="text-sm text-primaria underline">Importar clientes</Link>
    </div>
  )
}
