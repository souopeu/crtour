import { NextResponse, type NextRequest } from 'next/server'
import { decidirAcesso } from '@/lib/auth/acesso'
import { atualizarSessao } from '@/lib/supabase/proxy'

// Optimistic check only: every page and action re-validates the user on the server.
export async function proxy(request: NextRequest) {
  const { response, temSessao } = await atualizarSessao(request)
  const { pathname, search } = request.nextUrl
  const acesso = decidirAcesso(pathname, search, temSessao)
  if (acesso.tipo === 'seguir') return response

  const redirect = NextResponse.redirect(new URL(acesso.destino, request.url))
  // Keep refreshed auth cookies on the redirect response.
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
  return redirect
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icones|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
