import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Visitor without an account (public lead form): public key, no session. It can only call the functions granted to anon.
export function criarClientePublico() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !chave) throw new Error('Supabase não configurado')
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
}
