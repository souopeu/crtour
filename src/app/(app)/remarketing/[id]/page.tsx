import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { apagarSegmento, novaRodada, salvarMensagem } from '@/app/(app)/remarketing/actions'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { FormSegmento } from '@/components/remarketing/FormSegmento'
import { ItemFila } from '@/components/remarketing/ItemFila'
import { ROTULO_CONSENTIMENTO } from '@/lib/clientes/rotulos'
import { listarEtiquetas } from '@/lib/clientes/dados'
import { formatarDataHora } from '@/lib/formato'
import { buscarSegmento, chamadosNaRodada, clientesDoSegmento } from '@/lib/segmentos/dados'
import { aplicarModelo, descreverCriterios, separarFila } from '@/lib/segmentos/segmentos'
import { Carregando } from '@/components/Carregando'

export const metadata = { title: 'Segmento' }
const MODELO_PADRAO = 'Olá, {nome}! Tudo bem?'
const lista = 'flex flex-col divide-y divide-linha rounded-[--radius-cartao] border border-linha bg-superficie'

async function Conteudo({ params }: Pick<PageProps<'/remarketing/[id]'>, 'params'>) {
  const { id } = await params
  const segmento = await buscarSegmento(id)
  if (!segmento) notFound()
  const [clientes, chamados, etiquetas] = await Promise.all([
    clientesDoSegmento(segmento.criterios), chamadosNaRodada(segmento.id, segmento.rodada), listarEtiquetas(),
  ])
  const fila = separarFila(clientes, new Set(chamados.keys()))
  const modelo = segmento.mensagem || MODELO_PADRAO

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{segmento.nome}</h1>
      <p className="text-sm text-tinta-suave">
        {descreverCriterios(segmento.criterios, new Map(etiquetas.map((e) => [e.id, e.nome]))).join(' · ')} · {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'} · rodada {segmento.rodada}
      </p>

      <details className="rounded-[--radius-cartao] border border-linha bg-superficie p-3">
        <summary className="min-h-11 cursor-pointer content-center font-semibold">Editar nome e mensagem</summary>
        <div className="pt-3">
          <FormSegmento acao={salvarMensagem.bind(null, segmento.id)} inicial={{ nome: segmento.nome, mensagem: segmento.mensagem }} rotuloBotao="Salvar mensagem" />
        </div>
      </details>

      <section aria-labelledby="chamar-titulo" className="flex flex-col gap-2">
        <h2 id="chamar-titulo" className="text-lg font-semibold">Para chamar <span className="font-normal text-tinta-suave">({fila.paraChamar.length})</span></h2>
        {fila.paraChamar.length === 0 ? (
          <p className="text-sm text-tinta-suave">Ninguém para chamar nesta rodada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {fila.paraChamar.map((c) => (
              <ItemFila key={c.id} segmentoId={segmento.id} clienteId={c.id} nome={c.nome} whatsapp={c.whatsapp!} destino={c.destino} mensagem={aplicarModelo(modelo, c)} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="chamados-titulo" className="flex flex-col gap-2">
        <h2 id="chamados-titulo" className="text-lg font-semibold">Já chamados nesta rodada <span className="font-normal text-tinta-suave">({fila.jaChamados.length})</span></h2>
        {fila.jaChamados.length > 0 && (
          <>
            <ul className={lista}>
              {fila.jaChamados.map((c) => (
                <li key={c.id} className="flex justify-between gap-2 px-3 py-2 text-sm">
                  <Link href={`/clientes/${c.id}`} className="underline">{c.nome}</Link>
                  <span className="text-tinta-suave">✓ {formatarDataHora(chamados.get(c.id)!)}</span>
                </li>
              ))}
            </ul>
            <form action={novaRodada.bind(null, segmento.id, segmento.rodada)}>
              <button type="submit" className="min-h-11 w-fit text-primaria underline">Começar nova rodada (chamar todos de novo)</button>
            </form>
          </>
        )}
      </section>

      {(fila.semConsentimento.length > 0 || fila.semNumero.length > 0) && (
        <section aria-labelledby="fora-titulo" className="flex flex-col gap-2">
          <h2 id="fora-titulo" className="text-lg font-semibold">Fora do envio <span className="font-normal text-tinta-suave">({fila.semConsentimento.length + fila.semNumero.length})</span></h2>
          <p className="text-sm text-tinta-suave">Não recebem mensagem de remarketing. Para mudar, atualize o consentimento na ficha (só com autorização do cliente).</p>
          <ul className={lista}>
            {[...fila.semConsentimento, ...fila.semNumero].map((c) => (
              <li key={c.id} className="flex justify-between gap-2 px-3 py-2 text-sm">
                <Link href={`/clientes/${c.id}`} className="underline">{c.nome}</Link>
                <span className="text-tinta-suave">{c.consentimento_whatsapp === 'aceitou' ? 'Sem WhatsApp cadastrado' : ROTULO_CONSENTIMENTO[c.consentimento_whatsapp]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmarExclusao acao={apagarSegmento.bind(null, segmento.id)} rotulo="Apagar segmento" rotuloConfirmar="Apagar mesmo"
        aviso="Apaga o segmento e a marcação de quem já foi chamado. As atividades na ficha dos clientes continuam." />
    </>
  )
}

export default function SegmentoPage({ params }: PageProps<'/remarketing/[id]'>) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link href="/remarketing" className="w-fit text-primaria underline">Voltar para Remarketing</Link>
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  )
}
