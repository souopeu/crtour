import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { FormCampanha } from '@/components/campanhas/FormCampanha'
import { CampoCopiar } from '@/components/formulario/CampoCopiar'
import { ConfirmarExclusao } from '@/components/passeios/ConfirmarExclusao'
import { EstadoVazio } from '@/components/tela/EstadoVazio'
import { getMembro } from '@/lib/auth/agencia'
import { siteDaRequisicao } from '@/lib/auth/siteDaRequisicao'
import { indicadores, linkDaCampanha, periodoDoRelatorio, rotuloDoCanal } from '@/lib/campanhas/campanhas'
import { codigoDoFormulario, resultadoCampanhas } from '@/lib/campanhas/dados'
import { formatarDataBr, hojeNoBrasil, ouTraco } from '@/lib/formato'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { apagarCampanha } from './actions'

export const metadata = { title: 'Campanhas' }

const campo = 'h-11 rounded-lg border border-controle bg-superficie px-3 text-sm'
const reais = (c: number | null) => (c === null ? null : formatarReais(c))

async function Relatorio({ de, ate }: { de: string; ate: string }) {
  const [linhas, membro, codigo, site] = await Promise.all([resultadoCampanhas(de, ate), getMembro(), codigoDoFormulario(), siteDaRequisicao()])
  if (linhas.length === 0) {
    return <EstadoVazio compacto acoes={[{ href: '#nova-campanha', rotulo: 'Cadastrar a primeira campanha' }]}>Nenhum lead nem campanha no período. Cadastre a campanha e use o link dela no anúncio.</EstadoVazio>
  }
  const dono = membro?.papel === 'dono'
  return (
    <ul aria-label="Resultado por campanha" className="flex flex-col gap-3">
      {linhas.map((l) => {
        const n = indicadores(l)
        const link = l.campanha_id && l.canal && codigo && site ? linkDaCampanha(`${site}/f/${codigo}`, l.canal, l.chave ?? '') : null
        const titulo = l.nome ?? (l.chave ? `Etiqueta "${l.chave}"` : 'Origem não identificada')
        return (
          <li key={l.campanha_id ?? l.chave ?? 'sem-origem'} className="flex flex-col gap-3 rounded-[--radius-cartao] border border-linha bg-superficie p-4">
            <div>
              <p className="font-semibold">{titulo}</p>
              <p className="text-sm text-tinta-suave">
                {l.chave ? rotuloDoCanal(l.canal) : 'Leads sem etiqueta de campanha no link'}
                {l.inicio && ` · ${formatarDataBr(l.inicio)}${l.fim ? ` a ${formatarDataBr(l.fim)}` : ' em diante'}`}
              </p>
            </div>
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
            {l.campanha_id && !codigo && <p className="text-sm text-tinta-suave">Ligue o formulário de captação em Configurações para gerar o link do anúncio.</p>}
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
      <p className="text-sm text-tinta-suave">Venda é a negociação que chegou a Pago (ou depois). O gasto é o total informado na campanha, sem rateio pelo período.</p>
      <Suspense key={`${de}-${ate}`} fallback={<Carregando altura="h-40" />}>
        <Relatorio de={de} ate={ate} />
      </Suspense>
      {membro?.papel === 'dono' && (
        <section aria-labelledby="nova-campanha-titulo" className="flex flex-col gap-3">
          <h2 id="nova-campanha-titulo" className="text-lg font-semibold">Nova campanha</h2>
          <FormCampanha hoje={hoje} />
        </section>
      )}
    </>
  )
}

// R78, R79: campaigns (Meta, Google) and what each one brought: leads, sales, value, cost.
export default function CampanhasPage({ searchParams }: PageProps<'/campanhas'>) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Campanhas</h1>
      <Suspense fallback={<Carregando altura="h-40" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
