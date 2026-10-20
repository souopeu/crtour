import { pontosLinha } from '@/lib/graficos/graficos'
import { formatarReais } from '@/lib/passeios/dinheiro'
import { MESES } from '@/lib/segmentos/segmentos'
import { cartaoPainel } from '@/components/tela/estilos'

const L = 300
const A = 110
const curto = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1].slice(0, 3)}/${mes.slice(2, 4)}`

// R120: expected value per closing month as a line (monday "Previsão mensal"). Late and undated deals are told in text;
// the full numbers stay in the "Previsão por mês" table below.
export function LinhaPrevisao({ previsao }: { previsao: { chave: string; quantidade: number; previsto: number }[] }) {
  const meses = previsao.filter((p) => /^\d{4}-\d{2}$/.test(p.chave))
  const fora = previsao.filter((p) => !/^\d{4}-\d{2}$/.test(p.chave))
  const pontos = pontosLinha(meses.map((m) => m.previsto), L, A)
  return (
    <section aria-labelledby="linha-previsao-titulo" className={cartaoPainel}>
      <h2 id="linha-previsao-titulo" className="text-lg font-semibold">Previsão mensal</h2>
      {meses.length === 0 ? <p className="text-sm text-tinta-suave">Nenhuma negociação aberta com data esperada de fechamento.</p> : (
        <>
          <svg viewBox={`-12 -12 ${L + 24} ${A + 34}`} aria-hidden="true" className="w-full">
            <line x1="0" y1={A} x2={L} y2={A} className="stroke-linha" />
            <polyline points={pontos.map((p) => `${p.x},${p.y}`).join(' ')} className="fill-none stroke-primaria" strokeWidth="2.5" />
            {pontos.map((p, i) => (
              <g key={meses[i].chave}>
                <circle cx={p.x} cy={p.y} r="4" className="fill-primaria" />
                <text x={p.x} y={A + 18} textAnchor="middle" className="fill-tinta-suave text-[10px]">{curto(meses[i].chave)}</text>
              </g>
            ))}
          </svg>
          <p className="text-sm text-tinta-suave">
            {meses.map((m) => `${curto(m.chave)}: ${formatarReais(m.previsto)}`).join(' · ')}
          </p>
        </>
      )}
      {fora.length > 0 && (
        <p className="text-sm text-tinta-suave">
          Fora do gráfico: {fora.map((f) => `${f.chave === 'atrasada' ? 'data já passou' : 'sem data'} (${f.quantidade})`).join(' · ')}
        </p>
      )}
    </section>
  )
}
