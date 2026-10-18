import { aceitarSugestao, recusarSugestao } from '@/app/(app)/clientes/sugestoes-actions'

export type SugestaoView = { id: string; rotulo: string; atual: string; sugerido: string }

export function SugestoesCliente({ clienteId, sugestoes }: { clienteId: string; sugestoes: SugestaoView[] }) {
  if (sugestoes.length === 0) return null
  return (
    <section aria-labelledby="sugestoes-titulo" className="w-full rounded-[--radius-cartao] border border-linha bg-superficie p-3">
      <h2 id="sugestoes-titulo" className="text-lg font-semibold">Sugestões de uma planilha</h2>
      <p className="mb-2 text-sm text-tinta-suave">Uma planilha trouxe valores diferentes dos que estão na ficha. Nada foi trocado sem a sua escolha.</p>
      <ul className="flex flex-col gap-3">
        {sugestoes.map((s) => (
          <li key={s.id} className="flex flex-col gap-1">
            <p><strong>{s.rotulo}:</strong> hoje “{s.atual}”, a planilha diz “{s.sugerido}”.</p>
            <div className="flex gap-2">
              <form action={aceitarSugestao.bind(null, clienteId, s.id)}>
                <button type="submit" className="min-h-11 rounded-full bg-destaque px-4 font-semibold text-destaque-texto">Usar o da planilha</button>
              </form>
              <form action={recusarSugestao.bind(null, clienteId, s.id)}>
                <button type="submit" className="min-h-11 px-3 underline">Manter o atual</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
