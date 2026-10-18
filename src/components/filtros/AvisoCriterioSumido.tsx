// R84: shown when a tag or person in the filter no longer exists; the list ignores it.
export function AvisoCriterioSumido() {
  return (
    <p role="status" className="rounded-xl bg-alerta-suave p-3 text-sm text-tinta">
      Um critério deste filtro não existe mais (etiqueta apagada ou pessoa removida). A lista mostra o resto.
    </p>
  )
}
