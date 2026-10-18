import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

// Test-only, Node side: backdates rows the UI can never backdate (stage dates, registration dates).
// Reads the LOCAL service key from `supabase status`; refuses anything that is not localhost.
function admin() {
  const env = Object.fromEntries(
    execSync('supabase status -o env', { encoding: 'utf8' })
      .split('\n')
      .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], m[2]]),
  )
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(env.API_URL ?? '')) throw new Error('banco.ts only runs against the local Supabase')
  return createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export const diasAtras = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()

export async function atualizar(tabela: 'clientes' | 'negociacoes' | 'saidas', id: string, campos: Record<string, string>) {
  const { error } = await admin().from(tabela).update(campos).eq('id', id)
  if (error) throw new Error(`atualizar ${tabela}: ${error.message}`)
}

// Files left in a folder of the private receipts bucket (spec 18, R95).
export async function arquivosNaPasta(pasta: string): Promise<string[]> {
  const { data, error } = await admin().storage.from('comprovantes').list(pasta)
  if (error) throw new Error(`arquivosNaPasta: ${error.message}`)
  return (data ?? []).map((f) => f.name)
}
