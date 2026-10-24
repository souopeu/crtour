// R134: one page header for every screen — area label, big title, one line of description, actions on the right
// (they drop below the title on narrow screens). Actions are passed as children, main one first.
export function CabecalhoPagina({ area, titulo, descricao, children }: {
  area?: string; titulo: string; descricao?: string; children?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        {area ? <p className="text-xs font-semibold uppercase tracking-wide text-primaria">{area}</p> : null}
        <h1 className="text-[1.75rem] font-medium leading-tight tracking-tight">{titulo}</h1>
        {descricao ? <p className="text-sm text-tinta-suave">{descricao}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2 sm:flex-row-reverse sm:justify-start">{children}</div> : null}
    </header>
  )
}
