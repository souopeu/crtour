import { formatarDataHora } from '@/lib/formato'
import { rotuloDoTipo, type ItemDaLinha } from '@/lib/atividades/atividades'

export function LinhaDoTempo({ itens }: { itens: ItemDaLinha[] }) {
  return (
    <section aria-labelledby="linha-titulo" className="flex w-full flex-col gap-3">
      <h2 id="linha-titulo" className="text-lg font-semibold">Linha do tempo</h2>
      {itens.length === 0 ? (
        <p className="text-sm text-tinta-suave">Nada registrado ainda: anotações e atividades aparecem aqui, da mais recente para a mais antiga.</p>
      ) : (
        <ol className="flex flex-col gap-2 border-l-2 border-linha pl-4">
          {itens.slice(0, 30).map((i) => (
            <li key={`${i.tipo}-${i.id}`} className="text-sm">
              <span className="font-semibold">
                {i.tipo === 'anotacao' ? 'Anotação' : `${rotuloDoTipo(i.tipoAtividade)}${i.status === 'feito' ? ' (feita)' : ' (a fazer)'}`}
              </span>
              <span className="text-tinta-suave"> · {formatarDataHora(i.data)}</span>
              <p className="whitespace-pre-wrap break-words">{i.tipo === 'anotacao' ? i.texto : i.titulo}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
