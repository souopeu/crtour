import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { apagarSegmento, novaRodada, salvarMensagem } from '@/app/(app)/remarketing/actions'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { FormSegmento } from '@/components/remarketing/FormSegmento'
import { ItemFila } from '@/components/remarketing/ItemFila'
import { AbasDeVisao } from '@/components/tela/AbasDeVisao'
import { caixaTabela, chip, tabelaPadrao } from '@/components/tela/estilos'
import { ROTULO_CONSENTIMENTO } from '@/lib/clientes/rotulos'
import { listarEtiquetas } from '@/lib/clientes/dados'
import { formatarDataHora } from '@/lib/formato'
import { buscarSegmento, chamadosNaRodada, clientesDoSegmento } from '@/lib/segmentos/dados'
import { aplicarModelo, descreverCriterios, separarFila } from '@/lib/segmentos/segmentos'
import { Carregando } from '@/components/Carregando'

export const metadata = { title: 'Segmento' }
const MODELO_PADRAO = 'Olá, {nome}! Tudo bem?'
const ABAS = ['chamar', 'chamados', 'fora'] as const
type AbaSegmento = (typeof ABAS)[number]
const botaoContorno = 'inline-flex min-h-10 items-center rounded-full border border-controle bg-superficie px-4 text-sm font-semibold hover:bg-superficie-suave'

// R127: header with criteria chips, tabs with counters, and one table per tab (the WhatsApp button in the last column).
async function Conteudo({ params, searchParams }: Pick<PageProps<'/remarketing/[id]'>, 'params' | 'searchParams'>) {
  const { id } = await params
  const pedida = (await searchParams).aba
  const aba: AbaSegmento = (ABAS as readonly unknown[]).includes(pedida) ? (pedida as AbaSegmento) : 'chamar'
  const segmento = await buscarSegmento(id)
  if (!segmento) notFound()
  const [clientes, chamados, etiquetas] = await Promise.all([
    clientesDoSegmento(segmento.criterios), chamadosNaRodada(segmento.id, segmento.rodada), listarEtiquetas(),
  ])
  const fila = separarFila(clientes, new Set(chamados.keys()))
  const fora = [...fila.semConsentimento, ...fila.semNumero]
  const modelo = segmento.mensagem || MODELO_PADRAO
  const criterios = descreverCriterios(segmento.criterios, new Map(etiquetas.map((e) => [e.id, e.nome])))
  const contagem: Record<AbaSegmento, number> = { chamar: fila.paraChamar.length, chamados: fila.jaChamados.length, fora: fora.length }
  const rotulo: Record<AbaSegmento, string> = { chamar: 'Para chamar', chamados: 'Já chamados', fora: 'Sem permissão' }

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-[1.75rem] font-medium tracking-tight">{segmento.nome}</h1>
          <ul aria-label="Critérios" className="flex flex-wrap gap-2 text-sm">
            {criterios.map((c) => <li key={c} className="rounded-md bg-primaria-suave px-2 py-0.5 text-primaria">{c}</li>)}
            <li className="rounded-md bg-superficie-suave px-2 py-0.5">{clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}</li>
            <li className="rounded-md bg-superficie-suave px-2 py-0.5">rodada {segmento.rodada}</li>
          </ul>
        </div>
        <Link href={`/remarketing/${segmento.id}/editar`} className={botaoContorno}>Editar critérios</Link>
      </header>

      <details className="rounded-(--radius-cartao) border border-linha bg-superficie px-3">
        <summary className="min-h-11 cursor-pointer content-center font-semibold">Editar nome e mensagem</summary>
        <div className="pb-3">
          <FormSegmento acao={salvarMensagem.bind(null, segmento.id)} inicial={{ nome: segmento.nome, mensagem: segmento.mensagem }} rotuloBotao="Salvar mensagem" />
        </div>
      </details>

      <AbasDeVisao rotulo="Fila do segmento" abas={ABAS.map((a) => ({
        rotulo: `${rotulo[a]} (${contagem[a]})`, href: a === 'chamar' ? `/remarketing/${segmento.id}` : `/remarketing/${segmento.id}?aba=${a}`, ativa: a === aba,
      }))} />

      <section aria-labelledby="aba-titulo" className="flex flex-col gap-2">
        <h2 id="aba-titulo" className="sr-only">{aba === 'chamados' ? 'Já chamados nesta rodada' : rotulo[aba]} ({contagem[aba]})</h2>

        {aba === 'chamar' && (fila.paraChamar.length === 0 ? (
          <p className="text-sm text-tinta-suave">Ninguém para chamar nesta rodada.</p>
        ) : (
          <div className={caixaTabela}>
            <table className={tabelaPadrao}>
              <thead><tr><th>Cliente</th><th>Destino</th><th>Mensagem</th><th className="text-right">Ação</th></tr></thead>
              <tbody>
                {fila.paraChamar.map((c) => (
                  <ItemFila key={c.id} segmentoId={segmento.id} clienteId={c.id} nome={c.nome} whatsapp={c.whatsapp!} destino={c.destino} mensagem={aplicarModelo(modelo, c)} />
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {aba === 'chamados' && (fila.jaChamados.length === 0 ? (
          <p className="text-sm text-tinta-suave">Ninguém foi chamado nesta rodada ainda.</p>
        ) : (
          <>
            <div className={caixaTabela}>
              <table className={tabelaPadrao}>
                <thead><tr><th>Cliente</th><th>Chamado em</th></tr></thead>
                <tbody>
                  {fila.jaChamados.map((c) => (
                    <tr key={c.id}>
                      <td><Link href={`/clientes/${c.id}`} className={chip}>{c.nome}</Link></td>
                      <td className="text-tinta-suave">✓ {formatarDataHora(chamados.get(c.id)!)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form action={novaRodada.bind(null, segmento.id, segmento.rodada)}>
              <button type="submit" className={botaoContorno}>Começar nova rodada (chamar todos de novo)</button>
            </form>
          </>
        ))}

        {aba === 'fora' && (fora.length === 0 ? (
          <p className="text-sm text-tinta-suave">Todos os clientes do segmento podem receber mensagens.</p>
        ) : (
          <>
            <p className="text-sm text-tinta-suave">Não recebem mensagem de remarketing. Para mudar, atualize o consentimento na ficha (só com autorização do cliente).</p>
            <div className={caixaTabela}>
              <table className={tabelaPadrao}>
                <thead><tr><th>Cliente</th><th>Motivo</th></tr></thead>
                <tbody>
                  {fora.map((c) => (
                    <tr key={c.id}>
                      <td><Link href={`/clientes/${c.id}`} className={chip}>{c.nome}</Link></td>
                      <td className="text-tinta-suave">{c.consentimento_whatsapp === 'aceitou' ? 'Sem WhatsApp cadastrado' : ROTULO_CONSENTIMENTO[c.consentimento_whatsapp]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ))}
      </section>

      <ConfirmarExclusao acao={apagarSegmento.bind(null, segmento.id)} rotulo="Apagar segmento" rotuloConfirmar="Apagar mesmo"
        aviso="Apaga o segmento e a marcação de quem já foi chamado. As atividades na ficha dos clientes continuam." />
    </>
  )
}

export default function SegmentoPage({ params, searchParams }: PageProps<'/remarketing/[id]'>) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <Link href="/remarketing" className="w-fit text-sm text-primaria underline">← Remarketing</Link>
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
