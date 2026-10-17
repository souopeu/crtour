import Link from 'next/link'
import { Suspense } from 'react'
import { Carregando } from '@/components/Carregando'
import { getMembro } from '@/lib/auth/agencia'
import { rotuloDaRegra, totaisPorVendedor } from '@/lib/comissao/comissao'
import { buscarConfigComissao, listarComissoes } from '@/lib/comissao/dados'
import { formatarDataBr, hojeNoBrasil } from '@/lib/formato'
import { lerFiltrosPainel, rotuloDoMes } from '@/lib/painel/painel'
import { formatarReais } from '@/lib/passeios/dinheiro'

export const metadata = { title: 'Comissões' }
const tabela = 'w-full border-collapse text-sm [&_td]:border-t [&_td]:border-linha [&_td]:px-2 [&_td]:py-2 [&_th]:px-2 [&_th]:py-2 [&_th]:text-left'

async function Conteudo({ searchParams }: Pick<PageProps<'/comissoes'>, 'searchParams'>) {
  const [membro, sp] = await Promise.all([getMembro(), searchParams])
  if (!membro) return null
  const mes = lerFiltrosPainel(sp, hojeNoBrasil(), []).mes
  const [config, linhas] = await Promise.all([buscarConfigComissao(), listarComissoes(mes)])
  const ehDono = membro.papel === 'dono'
  const nome = new Map(config.membros.map((m) => [m.user_id, m.nome]))
  const total = linhas.reduce((s, l) => s + l.comissao_centavos, 0)

  if (!config.regra) {
    return <p className="rounded-[--radius-cartao] border border-linha bg-superficie p-4">A agência ainda não usa comissão. {ehDono ? <>Escolha a regra em <Link href="/configuracoes" className="text-primaria underline">Configurações</Link>.</> : 'Fale com o dono da agência.'}</p>
  }
  return (
    <>
      <form method="get" aria-label="Mês das comissões" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="mes" className="text-sm font-medium">Mês</label>
          <input id="mes" name="mes" type="month" defaultValue={mes} className="h-12 rounded-xl border border-controle bg-superficie px-3 text-base" />
        </div>
        <button type="submit" className="min-h-12 rounded-full bg-destaque px-6 font-semibold text-destaque-texto">Ver</button>
      </form>
      <p className="text-sm text-tinta-suave">
        Regra: {rotuloDaRegra(config.regra)}. A comissão entra no mês em que a reserva ficou quitada; estorno que reabre o saldo tira a comissão até quitar de novo.
        {!ehDono && ' Você vê só as suas.'}
      </p>

      <section aria-labelledby="total-titulo" className="flex flex-col gap-2 rounded-[--radius-cartao] border border-linha bg-superficie p-4">
        <h2 id="total-titulo" className="text-sm text-tinta-suave">Comissões de {rotuloDoMes(mes)}</h2>
        <p className="text-2xl font-bold">{formatarReais(total)}</p>
        {ehDono && linhas.length > 0 && (
          <ul aria-label="Por pessoa" className="text-sm">
            {totaisPorVendedor(linhas).map((t) => (
              <li key={t.vendedorId ?? 'sem'}>{t.vendedorId ? (nome.get(t.vendedorId) ?? 'Pessoa removida') : 'Sem vendedor(a)'}: <strong>{formatarReais(t.total)}</strong> ({t.quantidade} {t.quantidade === 1 ? 'reserva' : 'reservas'})</li>
            ))}
          </ul>
        )}
      </section>

      {linhas.length === 0 ? <p className="text-sm text-tinta-suave">Nenhuma reserva quitada neste mês.</p> : (
        <table className={tabela}>
          <thead><tr><th>Quitada em</th><th>Cliente</th><th>Passeio</th>{ehDono && <th>Vendido por</th>}<th>Valor</th><th>Comissão</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.reserva_id}>
                <td>{formatarDataBr(l.quitada_em)}</td>
                <td><Link href={`/reservas/${l.reserva_id}`} className="text-primaria underline">{l.cliente_nome}</Link></td>
                <td>{l.passeio_nome} · {formatarDataBr(l.saida_data)} · {l.qtd_pessoas} {l.qtd_pessoas === 1 ? 'pessoa' : 'pessoas'}</td>
                {ehDono && <td>{l.vendedor_id ? (nome.get(l.vendedor_id) ?? 'Pessoa removida') : 'Sem vendedor(a)'}</td>}
                <td>{formatarReais(l.valor_total_centavos)}</td>
                <td><strong>{formatarReais(l.comissao_centavos)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

export default function ComissoesPage({ searchParams }: PageProps<'/comissoes'>) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Comissões</h1>
      <Suspense fallback={<Carregando altura="h-64" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
