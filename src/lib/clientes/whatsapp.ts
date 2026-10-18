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
