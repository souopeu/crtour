import { proximoSeguro } from './redirect'

const PUBLICAS = new Set(['/login', '/cadastro', '/recuperar', '/privacidade', '/termos', '/auth/confirmar'])
// Server-to-server notices (payment providers): authenticated by the provider's signature, not by a session.
const PREFIXOS_PUBLICOS = ['/api/pagamentos/aviso/', '/f/', '/p/'] // public lead form (R65) and proposal link (R70)
// Pages a logged-in user has no reason to see.
const SO_ANONIMO = new Set(['/login', '/cadastro', '/recuperar'])

export type Acesso = { tipo: 'seguir' } | { tipo: 'redirecionar'; destino: string }

export function decidirAcesso(pathname: string, search: string, temSessao: boolean): Acesso {
  const publica = PUBLICAS.has(pathname) || PREFIXOS_PUBLICOS.some((p) => pathname.startsWith(p) && pathname.length > p.length)
  if (temSessao) {
    return SO_ANONIMO.has(pathname) ? { tipo: 'redirecionar', destino: '/' } : { tipo: 'seguir' }
  }
  if (publica) return { tipo: 'seguir' }
  const next = proximoSeguro(pathname + search)
  return { tipo: 'redirecionar', destino: `/login?next=${encodeURIComponent(next)}` }
}
