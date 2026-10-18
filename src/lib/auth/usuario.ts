import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/server'

// Validates the session with the auth server (never trusts the cookie alone).
export const getUsuario = cache(async () => {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.auth.getUser()
  return data.user
})

export async function exigirUsuario() {
  const usuario = await getUsuario()
  if (!usuario) redirect('/login')
  return usuario
}
