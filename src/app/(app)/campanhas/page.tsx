import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { BarraSituacao } from '@/components/campanhas/BarraSituacao'
import { FormCampanha } from '@/components/campanhas/FormCampanha'
import { FormLinkWhatsapp } from '@/components/campanhas/FormLinkWhatsapp'
import { CampoCopiar } from '@/components/formulario/CampoCopiar'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { getMembro } from '@/lib/auth/agencia'
import { siteDaRequisicao } from '@/lib/auth/siteDaRequisicao'
import { indicadores, linkDaCampanha, periodoDoRelatorio, SUFIXO_GOOGLE } from '@/lib/campanhas/campanhas'
import { buscarLinkWhatsapp, codigoDoFormulario, resultadoCampanhas } from '@/lib/campanhas/dados'
import { formatarWhatsapp } from '@/lib/clientes/rotulos'
import { rotuloDoCanalOrigem, tituloDaChave } from '@/lib/origens/origens'
import { formatarDataBr, hojeNoBrasil, ouTraco } from '@/lib/formato'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { apagarCampanha } from './actions'

export const metadata = { title: 'Campanhas' }

const campo = 'h-11 rounded-lg border border-controle bg-superficie px-3 text-sm'
const reais = (c: number | null) => (c === null ? null : formatarReais(c))

async function Relatorio({ de, ate }: { de: string; ate: string }) {
  const [linhas, membro, codigo, site] = await Promise.all([resultadoCampanhas(de, ate), getMembro(), codigoDoFormulario(), siteDaRequisicao()])
  if (linhas.length === 0) {
    return <EstadoVazio compacto acoes={[{ href: '/funil', rotulo: 'Ver o funil' }]}>Nenhum cliente novo no período. As campanhas aparecem aqui sozinhas quando chegam leads dos anúncios.</EstadoVazio>
  }
  const dono = membro?.papel === 'dono'
  return (
    <ul aria-label="Resultado por campanha" className="flex flex-col gap-3">
      {linhas.map((l) => {
        const n = indicadores(l)
        const link = l.campanha_id && l.canal && codigo && site ? linkDaCampanha(`${site}/f/${codigo}`, l.canal, l.chave ?? '') : null
        const titulo = tituloDaChave(l)
        return (
          <li key={l.campanha_id ?? l.chave ?? 'sem-origem'} className="flex flex-col gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-4">
            <div>
              <p className="font-semibold">{titulo}</p>
              <p className="text-sm text-tinta-suave">
                {l.chave ? rotuloDoCanalOrigem(l.canal) || 'Campanha cadastrada, sem leads no período' : 'Clientes novos sem anúncio nem link de campanha'}
                {l.inicio && ` · ${formatarDataBr(l.inicio)}${l.fim ? ` a ${formatarDataBr(l.fim)}` : ' em diante'}`}
              </p>
            </div>
            <BarraSituacao vendidos={l.vendas} perdidos={l.perdidos} emAberto={l.em_aberto} />
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-tinta-suave">Leads</dt><dd className="text-lg font-bold tabular-nums">{l.leads}</dd></div>
              <div><dt className="text-tinta-suave">Vendas</dt><dd className="text-lg font-bold tabular-nums">{l.vendas}</dd></div>
              <div><dt className="text-tinta-suave">Conversão</dt><dd className="text-lg font-bold tabular-nums">{ouTraco(n.conversao === null ? null : `${n.conversao.toLocaleString('pt-BR')}%`)}</dd></div>
              <div><dt className="text-tinta-suave">Vendido</dt><dd className="text-lg font-bold tabular-nums">{formatarReais(l.valor_vendido_centavos)}</dd></div>
              {l.campanha_id && (
                <>
                  <div><dt className="text-tinta-suave">Gasto total</dt><dd className="tabular-nums">{formatarReais(l.gasto_centavos)}</dd></div>
                  <div><dt className="text-tinta-suave">Custo por lead</dt><dd className="tabular-nums">{ouTraco(reais(n.custoPorLeadCentavos))}</dd></div>
                  <div><dt className="text-tinta-suave">Custo por venda</dt><dd className="tabular-nums">{ouTraco(reais(n.custoPorVendaCentavos))}</dd></div>
                  <div><dt className="text-tinta-suave">Retorno</dt><dd className="tabular-nums">{ouTraco(n.retorno === null ? null : `${n.retorno.toLocaleString('pt-BR')}×`)}</dd></div>
                </>
              )}
            </dl>
            {link && <CampoCopiar id={`link-${l.campanha_id}`} rotulo="Link para colar no anúncio" valor={link} />}
            {dono && l.campanha_id && (
              <ConfirmarExclusao acao={apagarCampanha.bind(null, l.campanha_id)} rotulo={`Apagar ${l.nome}`} rotuloConfirmar="Apagar mesmo"
                aviso="Apaga a campanha. Os leads e as vendas continuam no funil, com a etiqueta." />
            )}
          </li>
        )
      })}
    </ul>
  )
}

// R81: the link for Google ads: stores the click and opens the agency's WhatsApp with a short code.
async function LinkGoogle() {
  const [link, site] = await Promise.all([buscarLinkWhatsapp(), siteDaRequisicao()])
  const url = link && site ? `${site}/w/${link.codigo}` : null
  return (
    <section aria-labelledby="link-google-titulo" className="flex flex-col gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-4">
      <h2 id="link-google-titulo" className="text-lg font-semibold">Link do WhatsApp para anúncios do Google</h2>
      <p className="text-sm text-tinta-suave">
        O Google não diz ao WhatsApp de qual anúncio o cliente veio. Use este link como URL final do anúncio: ele guarda o clique e abre o WhatsApp da
        agência com uma mensagem pronta e um código curto. Quando a mensagem chegar ao CRM, o perfil do cliente mostra a campanha. Se o cliente apagar o
        código, a origem fica &quot;não identificada&quot;. Anúncios do Meta (clique para WhatsApp) não precisam de link: os dados chegam junto com a mensagem.
      </p>
      {url && link?.ativo && (
        <>
          <CampoCopiar id="link-google" rotulo="URL final do anúncio" valor={url} />
          <CampoCopiar id="sufixo-google" rotulo="Sufixo do URL final (troque nome-da-campanha)" valor={SUFIXO_GOOGLE} />
          <p className="text-sm text-tinta-suave">Deixe a codificação automática ligada no Google Ads: ela acrescenta o identificador do clique (gclid).</p>
        </>
      )}
      <FormLinkWhatsapp inicial={{ whatsapp: link ? formatarWhatsapp(link.whatsapp) : '', mensagem: link?.mensagem ?? 'Olá! Quero saber dos passeios.', ativo: link?.ativo ?? true }} />
      <p className="text-sm text-tinta-suave">O código só é lido quando o WhatsApp da agência estiver ligado ao CRM pela API oficial.</p>
    </section>
  )
}

async function Conteudo({ searchParams }: Pick<PageProps<'/campanhas'>, 'searchParams'>) {
  const [sp, membro] = await Promise.all([searchParams, getMembro()])
  const hoje = hojeNoBrasil()
  const { de, ate } = periodoDoRelatorio(sp, hoje)
  return (
    <>
      <form aria-label="Período" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1"><label htmlFor="per-de" className="text-sm font-medium">Leads de</label><input id="per-de" name="de" type="date" defaultValue={de} className={campo} /></div>
        <div className="flex flex-col gap-1"><label htmlFor="per-ate" className="text-sm font-medium">até</label><input id="per-ate" name="ate" type="date" defaultValue={ate} className={campo} /></div>
        <button type="submit" className="min-h-11 rounded-lg border border-controle px-4 text-sm">Ver período</button>
      </form>
      <p className="text-sm text-tinta-suave">Cada linha junta os clientes que chegaram pelo mesmo anúncio ou campanha no período. Venda é o cliente com negociação em Pago (ou depois) aberta depois da chegada. O gasto, quando informado, é o total da campanha, sem rateio pelo período.</p>
      <Suspense key={`${de}-${ate}`} fallback={<Carregando altura="h-40" />}>
        <Relatorio de={de} ate={ate} />
      </Suspense>
      {membro?.papel === 'dono' && (
        <>
          <Suspense fallback={<Carregando altura="h-40" />}><LinkGoogle /></Suspense>
          <section aria-labelledby="nova-campanha-titulo" className="flex flex-col gap-3">
            <h2 id="nova-campanha-titulo" className="text-lg font-semibold">Informar o gasto de uma campanha (opcional)</h2>
            <p className="text-sm text-tinta-suave">Não é preciso cadastrar nada para a campanha aparecer. Use isto só para ver custo por lead e por venda: a etiqueta tem de ser igual à utm_campaign do anúncio.</p>
            <FormCampanha hoje={hoje} />
          </section>
        </>
      )}
    </>
  )
}

// R78, R79: campaigns (Meta, Google) and what each one brought: leads, sales, value, cost.
export default function CampanhasPage({ searchParams }: PageProps<'/campanhas'>) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-[1.75rem] font-medium tracking-tight">Campanhas</h1>
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
