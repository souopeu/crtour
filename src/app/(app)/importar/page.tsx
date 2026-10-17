import Link from 'next/link'
import { Suspense } from 'react'
import { FormImportar } from '@/components/importacao/FormImportar'
import { ImportacoesAnteriores } from '@/components/importacao/ImportacoesAnteriores'
import { listarImportacoes } from '@/lib/clientes/dados'
import { formatarDataHora } from '@/lib/formato'
import { Carregando } from '@/components/Carregando'

export const metadata = { title: 'Importar planilha' }

async function Anteriores() {
  const lista = await listarImportacoes()
  return (
    <ImportacoesAnteriores
      importacoes={lista.map((i) => ({ id: i.id, nome: i.nome, quando: formatarDataHora(i.criada_em), criados: i.qtd_criados, ignorados: i.qtd_ignorados }))}
    />
  )
}

export default function ImportarPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar planilha</h1>
        <p className="mt-1 text-tinta-suave">
          Traga seus clientes de outra planilha. Você confere tudo antes de importar e pode desfazer depois.
        </p>
        <a href="/importar/modelo" className="mt-3 inline-flex min-h-11 items-center text-primaria underline">Baixar planilha-modelo (.xlsx)</a>
        <Link href="/importar/reservas" className="ml-4 mt-3 inline-flex min-h-11 items-center text-primaria underline">Importar reservas</Link>
      </div>
      <FormImportar />
      <section aria-labelledby="anteriores-titulo" className="flex flex-col gap-2">
        <h2 id="anteriores-titulo" className="text-lg font-semibold">Importações anteriores</h2>
        <Suspense fallback={<Carregando altura="h-20" />}>
          <Anteriores />
        </Suspense>
      </section>
      <Link href="/" className="text-sm text-primaria underline">Voltar para os clientes</Link>
    </div>
  )
}
