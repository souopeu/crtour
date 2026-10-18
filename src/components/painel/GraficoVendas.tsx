import { proporcao } from '@/lib/graficos/graficos'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { MESES } from '@/lib/segmentos/segmentos'
import { caixaTabela, tabelaPadrao } from '@/components/tela/estilos'

type Mes = { mes: string; vendido: number; perdido: number; meta: number | null }

const curto = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1].slice(0, 3)

// R97, R99: sold and lost per month as columns (decoration), with the same numbers in a table below.
export function GraficoVendas({ meses, escolhido }: { meses: Mes[]; escolhido: string }) {
  const maximo = Math.max(0, ...meses.flatMap((m) => [m.vendido, m.perdido, m.meta ?? 0]))
  const temMeta = meses.some((m) => m.meta !== null)
  return (
    <section aria-labelledby="grafico-vendas-titulo" className="flex flex-col gap-3">
      <h2 id="grafico-vendas-titulo" className="text-lg font-semibold">Vendas nos últimos {meses.length} meses</h2>
      <div aria-hidden="true" className="flex flex-col gap-2 rounded-(--radius-cartao) border border-linha bg-superficie p-3">
        <div className="flex h-40 items-stretch gap-1 sm:gap-2">
          {meses.map((m) => (
            <div key={m.mes} className={`relative flex flex-1 items-end justify-center gap-0.5 rounded-md px-0.5 ${m.mes === escolhido ? 'bg-primaria-suave' : ''}`}>
              <div className="w-1/3 max-w-6 rounded-t bg-receita" style={{ height: `${proporcao(m.vendido, maximo)}%` }} />
              <div className="w-1/3 max-w-6 rounded-t bg-despesa" style={{ height: `${proporcao(m.perdido, maximo)}%` }} />
              {m.meta !== null && <div className="absolute inset-x-0 border-t-2 border-dashed border-tinta" style={{ bottom: `${proporcao(m.meta, maximo)}%` }} />}
            </div>
          ))}
        </div>
        <div className="flex gap-1 sm:gap-2">
          {meses.map((m) => (
            <span key={m.mes} className={`flex-1 text-center text-xs ${m.mes === escolhido ? 'font-bold text-tinta' : 'text-tinta-suave'}`}>{curto(m.mes)}</span>
          ))}
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-tinta-suave">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-receita" />Vendido</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-despesa" />Perdido</span>
          {temMeta && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-tinta" />Meta</span>}
        </p>
      </div>
      <div className={caixaTabela}>
        <table className={tabelaPadrao}>
          <thead><tr><th>Mês</th><th>Vendido</th><th>Perdido</th>{temMeta && <th>Meta</th>}</tr></thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.mes} className={m.mes === escolhido ? 'font-semibold' : undefined}>
                <td>{curto(m.mes)}/{m.mes.slice(2, 4)}</td><td>{formatarReais(m.vendido)}</td><td>{formatarReais(m.perdido)}</td>
                {temMeta && <td>{m.meta === null ? '—' : formatarReais(m.meta)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
