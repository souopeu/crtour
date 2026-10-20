import { fatiasPizza } from '@/lib/graficos/graficos'
import { rotuloDaEtapa, type Etapa } from '@/lib/negociacoes/negociacoes'
import { cartaoPainel } from '@/components/tela/estilos'

// Static class names (Tailwind must see them whole), from the stage tokens.
const FATIA: Partial<Record<Etapa, { fill: string; bg: string }>> = {
  interessado: { fill: 'fill-etapa-interessado-borda', bg: 'bg-etapa-interessado-borda' },
  orcamento: { fill: 'fill-etapa-orcamento-borda', bg: 'bg-etapa-orcamento-borda' },
  reservado: { fill: 'fill-etapa-reservado-borda', bg: 'bg-etapa-reservado-borda' },
}

// R120: open deals by stage as a pie (monday "Distribuição por estágio"). The legend carries name, share and count in text.
export function PizzaEtapas({ etapas }: { etapas: { etapa: Etapa; quantidade: number }[] }) {
  const abertas = etapas.filter((e) => FATIA[e.etapa])
  const total = abertas.reduce((s, e) => s + e.quantidade, 0)
  const fatias = fatiasPizza(abertas.map((e) => e.quantidade), 60, 60, 56)
  return (
    <section aria-labelledby="pizza-titulo" className={cartaoPainel}>
      <h2 id="pizza-titulo" className="text-lg font-semibold">Negociações abertas por etapa</h2>
      {total === 0 ? <p className="text-sm text-tinta-suave">Nenhuma negociação em aberto.</p> : (
        <div className="flex flex-wrap items-center justify-center gap-4">
          <svg viewBox="0 0 120 120" aria-hidden="true" className="size-36">
            {fatias.map((f, i) => f.caminho && <path key={abertas[i].etapa} d={f.caminho} className={`${FATIA[abertas[i].etapa]!.fill} stroke-superficie`} strokeWidth="1.5" />)}
          </svg>
          <ul className="flex flex-col gap-1 text-sm">
            {abertas.map((e, i) => (
              <li key={e.etapa} className="flex items-center gap-2">
                <span aria-hidden="true" className={`size-3 rounded-full ${FATIA[e.etapa]!.bg}`} />
                {rotuloDaEtapa(e.etapa)}: {Math.round(fatias[i].fracao * 100)}% <span className="text-tinta-suave">({e.quantidade})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
