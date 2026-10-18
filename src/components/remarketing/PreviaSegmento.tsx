import { ROTULO_CONSENTIMENTO } from '@/lib/clientes/rotulos'
import type { ClienteSegmento } from '@/lib/segmentos/dados'
import { descreverCriterios, type Criterios } from '@/lib/segmentos/segmentos'

const PREVIA = 50

// Count and first names of who matches the criteria, before saving.
export function PreviaSegmento({ criterios, clientes, etiquetas }: { criterios: Criterios; clientes: ClienteSegmento[]; etiquetas: Map<string, string> }) {
  const aceitaram = clientes.filter((c) => c.consentimento_whatsapp === 'aceitou').length
  return (
    <section aria-labelledby="previa-titulo" className="flex flex-col gap-2">
      <h2 id="previa-titulo" className="text-lg font-semibold">{clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}</h2>
      <p className="text-sm text-tinta-suave">{descreverCriterios(criterios, etiquetas).join(' · ')} · {aceitaram} com consentimento para mensagens</p>
      {clientes.length > 0 && (
        <ul className="flex flex-col divide-y divide-linha rounded-[--radius-cartao] border border-linha bg-superficie">
          {clientes.slice(0, PREVIA).map((c) => (
            <li key={c.id} className="flex justify-between gap-2 px-3 py-2 text-sm">
              <span>{c.nome}</span><span className="text-tinta-suave">{ROTULO_CONSENTIMENTO[c.consentimento_whatsapp]}</span>
            </li>
          ))}
        </ul>
      )}
      {clientes.length > PREVIA && <p className="text-sm text-tinta-suave">Mostrando {PREVIA} de {clientes.length}.</p>}
    </section>
  )
}
