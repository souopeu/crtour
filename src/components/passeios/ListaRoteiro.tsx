// R165: day-by-day itinerary of an excursion, as frozen in a voucher or a proposal.
export function ListaRoteiro({ roteiro }: { roteiro: { dia: number; titulo: string; descricao: string | null }[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {roteiro.map((d) => (
        <li key={d.dia}>
          <p className="font-semibold">Dia {d.dia} · {d.titulo}</p>
          {d.descricao && <p className="whitespace-pre-line text-sm">{d.descricao}</p>}
        </li>
      ))}
    </ol>
  )
}
