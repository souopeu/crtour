import { timingSafeEqual } from 'node:crypto'

// R132: the clock route accepts only "Authorization: Bearer <CRON_SECRET>" (what Vercel Cron sends).
// No secret configured = the route is closed. Constant-time compare, so the secret cannot be guessed by timing.
export function relogioAutorizado(cabecalho: string | null, segredo: string | undefined): boolean {
  if (!segredo || segredo.length < 16 || !cabecalho) return false
  const esperado = Buffer.from(`Bearer ${segredo}`)
  const recebido = Buffer.from(cabecalho)
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
}
