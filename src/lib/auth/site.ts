function origemValida(valor: string | null | undefined): string | null {
  if (!valor) return null
  try {
    const url = new URL(valor)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

// Base URL used in e-mailed links (confirm signup, reset password). In production it comes only from
// configuration: trusting the request's Origin/Host header would let an attacker trigger a reset e-mail
// whose link points to their own site and steal the token.
export function urlDoSite(
  env: { NEXT_PUBLIC_SITE_URL?: string; NODE_ENV?: string },
  origemDoCabecalho: string | null,
): string | null {
  const configurada = origemValida(env.NEXT_PUBLIC_SITE_URL)
  if (configurada) return configurada
  return env.NODE_ENV === 'production' ? null : origemValida(origemDoCabecalho)
}
