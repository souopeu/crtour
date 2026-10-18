// A client tag with its color as a dot; the name stays in text color so contrast never depends on the tag color (R99).
export function EtiquetaCor({ nome, cor }: { nome: string; cor: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-linha px-1.5 py-0.5 text-xs">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
      <span className="truncate">{nome}</span>
    </span>
  )
}
