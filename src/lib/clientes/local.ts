// R126: country, state and city. In Brazil the state is a UF; abroad it is free text.
export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
  'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export const PAIS_PADRAO = 'Brasil'

// "brasil", "BRAZIL", " Brasil " all mean the default country.
export function normalizarPais(entrada: string): string {
  const p = entrada.trim().replace(/\s+/g, ' ')
  if (p === '' || /^bra[sz]il$/i.test(p)) return PAIS_PADRAO
  return p
}

export const ehBrasil = (pais: string) => normalizarPais(pais) === PAIS_PADRAO

// "São Paulo · SP" / "Lisboa · Lisboa · Portugal"; empty parts are left out.
export function rotuloLocal(cidade: string | null, estado: string | null, pais: string | null): string {
  return [cidade, estado, pais && pais !== PAIS_PADRAO ? pais : null].filter(Boolean).join(' · ')
}
