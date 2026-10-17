import Link from 'next/link'
import { Suspense } from 'react'
import { criarSegmento } from '@/app/(app)/remarketing/actions'
import { FiltrosSegmento } from '@/components/remarketing/FiltrosSegmento'
import { FormSegmento } from '@/components/remarketing/FormSegmento'
import { ROTULO_CONSENTIMENTO } from '@/lib/clientes/rotulos'
import { listarCidades, listarEtiquetas } from '@/lib/clientes/dados'
import { clientesDoSegmento } from '@/lib/segmentos/dados'
import { criteriosParaQuery, descreverCriterios, lerCriterios } from '@/lib/segmentos/segmentos'

export const metadata = { title: 'Novo segmento' }
const PREVIA = 50

async function Conteudo({ searchParams }: Pick<PageProps<'/remarketing/novo'>, 'searchParams'>) {
  const criterios = lerCriterios(await searchParams)
  const [etiquetas, cidades, clientes] = await Promise.all([listarEtiquetas(), listarCidades(), clientesDoSegmento(criterios)])
  const aceitaram = clientes.filter((c) => c.consentimento_whatsapp === 'aceitou').length
  return (
    <>
      <FiltrosSegmento criterios={criterios} etiquetas={etiquetas} cidades={cidades} />

      <section aria-labelledby="previa-titulo" className="flex flex-col gap-2">
        <h2 id="previa-titulo" className="text-lg font-semibold">{clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}</h2>
        <p className="text-sm text-tinta-suave">{descreverCriterios(criterios, new Map(etiquetas.map((e) => [e.id, e.nome]))).join(' · ')} · {aceitaram} com consentimento para mensagens</p>
        {clientes.length > 0 && (
          <ul className="flex flex-col divide-y divide-linha rounded-[--radius-cartao] border border-linha bg-superficie">
            {clientes.slice(0, PREVIA).map((c) => (
              <li key={c.id} className="flex justify-between gap-2 px-3 py-2 text-sm">
                <span>{c.nome}</span><span className="text-tinta-suave">{ROTULO_CONSENTIMENTO[c.consentimento_whatsapp]}</span>
              </li>
            ))}
          </ul>
        )}
        {clientes.length > PREVIA && <p className="text-sm text-tinta-suave">Mostrando {PREVIA} de {clientes.length}.</p>}
      </section>

      <section aria-labelledby="salvar-titulo" className="flex flex-col gap-2">
        <h2 id="salvar-titulo" className="text-lg font-semibold">Salvar segmento</h2>
        <FormSegmento acao={criarSegmento} criterios={criteriosParaQuery(criterios)} inicial={{ nome: '', mensagem: 'Olá, {nome}! Tudo bem? Temos novidades de {destino} para você.' }} rotuloBotao="Salvar segmento" />
      </section>
    </>
  )
}

export default function NovoSegmentoPage({ searchParams }: PageProps<'/remarketing/novo'>) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/remarketing" className="w-fit text-primaria underline">Voltar para Remarketing</Link>
      <h1 className="text-2xl font-bold tracking-tight">Novo segmento</h1>
      <Suspense fallback={<div aria-busy="true" aria-label="Carregando" className="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
