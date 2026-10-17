export type EstadoForm = {
  erro?: string
  ok?: string
  campos?: Record<string, string[] | undefined>
  valores?: Record<string, string>
  // Changes on every submission so the form remounts with the submitted/saved values.
  versao?: string
}
