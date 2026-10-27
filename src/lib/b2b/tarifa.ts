// E11-4 (R163): filter lists by rate (counter or B2B). Owner only: the screens show it to the owner.
export const TARIFAS = { balcao: 'Balcão', b2b: 'B2B' } as const
export type Tarifa = keyof typeof TARIFAS

export const lerFiltroTarifa = (v: unknown): Tarifa | null => (v === 'balcao' || v === 'b2b' ? v : null)

// Same address with the rate changed (null removes it); the other filters stay.
export function hrefTarifa(base: string, params: Record<string, string | string[] | undefined>, tarifa: Tarifa | null): string {
  const busca = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (k !== 'tarifa' && typeof v === 'string') busca.set(k, v)
  if (tarifa) busca.set('tarifa', tarifa)
  const texto = busca.toString()
  return texto ? `${base}?${texto}` : base
}
