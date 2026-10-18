import type { EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { proximoSeguro } from '@/lib/auth/redirect'
import { criarClienteServidor } from '@/lib/supabase/server'

// Landing point of the links sent by e-mail (confirm signup, reset password).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const tokenHash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null
  const next = proximoSeguro(params.get('next'))

  if (tokenHash && type) {
    const supabase = await criarClienteServidor()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) redirect(next)
  }
  redirect('/login?erro=link')
}
