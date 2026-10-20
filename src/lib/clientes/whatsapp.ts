export type ResultadoWhatsapp = { ok: true; valor: string | null } | { ok: false }

// Stores digits only, with country code. Numbers typed with "+" keep their own country code;
// otherwise they are assumed Brazilian (DDD + number, optional leading 0 or 55).
export function normalizarWhatsapp(entrada: string | null | undefined): ResultadoWhatsapp {
  const bruto = (entrada ?? '').trim()
  if (bruto === '') return { ok: true, valor: null }

  const internacional = bruto.startsWith('+')
  let digitos = bruto.replace(/\D/g, '')

  if (!internacional) {
    digitos = digitos.replace(/^0+/, '')
    if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`
  }
  return /^\d{10,15}$/.test(digitos) ? { ok: true, valor: digitos } : { ok: false }
}

// R124: what the field shows while typing. Only digits get in; Brazil as (DD) NNNNN-NNNN,
// "+" (or more than 11 digits) as +digits. The stored value still comes from normalizarWhatsapp.
export function mascararWhatsapp(entrada: string): string {
  const internacional = entrada.trim().startsWith('+')
  const digitos = entrada.replace(/\D/g, '')
  const d = internacional ? digitos : digitos.replace(/^0+/, '')
  if (internacional || d.length > 11) return d === '' ? '+' : `+${d.slice(0, 15)}`
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  const ddd = d.slice(0, 2)
  const resto = d.slice(2)
  if (resto.length <= 4) return `(${ddd}) ${resto}`
  const meio = resto.length === 9 ? 5 : 4
  return `(${ddd}) ${resto.slice(0, meio)}-${resto.slice(meio)}`
}
