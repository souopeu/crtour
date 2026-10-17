const FORMATO = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  hour12: false, timeZone: 'America/Sao_Paulo',
})

// "17/10/2026 12:30" in Brazil time; empty string when the input is not a date.
export function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = Object.fromEntries(FORMATO.formatToParts(d).map((x) => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

// 'YYYY-MM-DD' -> 'DD/MM/YYYY' by string, so no timezone can shift the day.
export function formatarDataBr(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

const DIA_BRASIL = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }) // YYYY-MM-DD

export function hojeNoBrasil(agora: Date = new Date()): string {
  return DIA_BRASIL.format(agora)
}
