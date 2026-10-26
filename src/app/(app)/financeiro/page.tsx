import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { AbasFinanceiro } from '@/components/financeiro/AbasFinanceiro'
import { SoDono } from '@/components/financeiro/SoDono'
import { CabecalhoPagina } from '@/components/tela/CabecalhoPagina'
import { botaoBarra, campoBarra, rotuloBarra } from '@/components/tela/estilos'
import { getMembro } from '@/lib/auth/agencia'
import { listarAPagar } from '@/lib/contas/dados'
import { dadosVisaoGeral } from '@/lib/financeiro/dados'
import { fimDoMes, visaoGeral } from '@/lib/financeiro/visaoGeral'
import { hojeNoBrasil } from '@/lib/formato'
import { lerFiltrosPainel, rotuloDoMes } from '@/lib/painel/painel'
import { formatarReais } from '@/lib/passeios/dinheiro'

export const metadata = { title: 'Financeiro' }

function Cartao({ titulo, valor, detalhe, href, link, cor = '' }: { titulo: string; valor: number; detalhe: string; href: string; link: string; cor?: string }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-1 rounded-(--radius-cartao) border border-linha bg-superficie p-4">
      <h2 className="text-sm text-tinta-suave">{titulo}</h2>
      <p className={`text-2xl font-bold tabular-nums ${cor}`}>{formatarReais(valor)}</p>
      <p className="text-sm text-tinta-suave">{detalhe}</p>
      <Link href={href} className="mt-auto pt-2 text-sm text-primaria underline">{link}</Link>
    </section>
  )
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

async function Conteudo({ searchParams }: Pick<PageProps<'/financeiro'>, 'searchParams'>) {
  const [sp, membro] = await Promise.all([searchParams, getMembro()])
  if (membro?.papel !== 'dono') return <SoDono />
  await connection() // "today" is per request
  const hoje = hojeNoBrasil()
  const mes = lerFiltrosPainel(sp, hoje, []).mes
  const [dados, aPagar] = await Promise.all([dadosVisaoGeral(`${mes}-01`, fimDoMes(mes)), listarAPagar()])
  const v = visaoGeral({ ...dados, aPagar }, mes, hoje)

  return (
    <>
      <form method="get" aria-label="Mês da visão geral" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="mes" className={rotuloBarra}>Mês</label>
          <input id="mes" name="mes" type="month" defaultValue={mes} className={campoBarra} />
        </div>
        <button type="submit" className={botaoBarra}>Ver</button>
      </form>

      <h2 className="text-lg font-semibold">{rotuloDoMes(mes)}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Cartao titulo="Vendido" valor={v.vendido.valor} detalhe={`${plural(v.vendido.quantidade, 'reserva criada', 'reservas criadas')} no mês (sem as canceladas)`} href="/reservas" link="Ver reservas" />
        <Cartao titulo="Recebido" valor={v.recebido} cor="text-receita" detalhe="Pagamentos do mês, menos estornos" href="/financeiro/conferencia" link="Ver dia a dia" />
        <Cartao titulo="Pago" valor={v.pago} cor="text-despesa" detalhe="Contas, custos de saídas e comissões pagos no mês" href="/financeiro/contas?filtro=pagas" link="Ver contas pagas" />
        <Cartao titulo="Resultado de caixa" valor={v.resultado} cor={v.resultado < 0 ? 'text-despesa' : 'text-receita'} detalhe="Recebido menos pago no mês" href="/financeiro/conferencia" link="Ver conferência diária" />
        <Cartao titulo="A receber" valor={v.aReceber.valor} detalhe={`Hoje, em ${plural(v.aReceber.quantidade, 'reserva ativa', 'reservas ativas')}`} href="/cobrancas" link="Ver cobranças" />
        <Cartao titulo="A pagar" valor={v.aPagar.vencido + v.aPagar.aVencer} cor={v.aPagar.vencido > 0 ? 'text-despesa' : ''}
          detalhe={`Hoje: ${formatarReais(v.aPagar.vencido)} vencido · ${formatarReais(v.aPagar.aVencer)} a vencer`} href="/financeiro/contas" link="Ver contas a pagar" />
      </div>
      <p className="text-sm text-tinta-suave">Vendido, recebido e pago são do mês escolhido; a receber e a pagar são o que está em aberto hoje.</p>
    </>
  )
}

export default function FinanceiroPage({ searchParams }: PageProps<'/financeiro'>) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <CabecalhoPagina area="Financeiro" titulo="Visão geral" descricao="O dinheiro da agência no mês: o que foi vendido, recebido e pago, e o que está em aberto." />
      <AbasFinanceiro caminho="/financeiro" />
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
