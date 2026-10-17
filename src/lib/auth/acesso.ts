import { proximoSeguro } from './redirect'

const PUBLICAS = new Set(['/login', '/cadastro', '/recuperar', '/privacidade', '/termos', '/auth/confirmar'])
// Pages a logged-in user has no reason to see.
const SO_ANONIMO = new Set(['/login', '/cadastro', '/recuperar'])

export type Acesso = { tipo: 'seguir' } | { tipo: 'redirecionar'; destino: string }

export function decidirAcesso(pathname: string, search: string, temSessao: boolean): Acesso {
  if (temSessao) {
    return SO_ANONIMO.has(pathname) ? { tipo: 'redirecionar', destino: '/' } : { tipo: 'seguir' }
  }
  if (PUBLICAS.has(pathname)) return { tipo: 'seguir' }
  const next = proximoSeguro(pathname + search)
  return { tipo: 'redirecionar', destino: `/login?next=${encodeURIComponent(next)}` }
}
