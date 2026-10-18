import { formatarDataHora } from '@/lib/formato'
import type { OrigemLinha } from '@/lib/origens/dados'
import { descreverOrigem } from '@/lib/origens/origens'

// R80: how the client found the agency, filled only by what arrived (ad data, Google click code, form link).
export function DeOndeVeio({ origens }: { origens: OrigemLinha[] }) {
  return (
    <section aria-labelledby="origem-titulo" className="flex flex-col gap-3">
      <h2 id="origem-titulo" className="text-lg font-semibold">De onde veio</h2>
      {origens.length === 0 ? (
        <p className="text-sm text-tinta-suave">Origem não identificada: nenhum anúncio ou link de campanha chegou com este cliente.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {origens.map((o, i) => {
            const d = descreverOrigem(o)
            return (
              <li key={`${o.criado_em}-${i}`} className={`flex flex-col gap-0.5 rounded-lg border border-l-4 border-linha p-3 ${i === 0 ? 'border-l-primaria' : 'border-l-controle'}`}>
                <p className="font-semibold">{d.titulo}{i === 0 && origens.length > 1 && <span className="text-sm font-normal text-tinta-suave"> · primeiro contato</span>}</p>
                <p className="text-sm">{d.detalhe}</p>
                <p className="text-sm text-tinta-suave">{formatarDataHora(o.criado_em)}</p>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
