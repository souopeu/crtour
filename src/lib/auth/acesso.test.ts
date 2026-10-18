import { describe, expect, test } from 'vitest'
import { decidirAcesso } from './acesso'

describe('decidirAcesso', () => {
  test('sends anonymous users to /login keeping the destination', () => {
    expect(decidirAcesso('/clientes', '?q=ana', false)).toEqual({ tipo: 'redirecionar', destino: '/login?next=%2Fclientes%3Fq%3Dana' })
    expect(decidirAcesso('/', '', false)).toEqual({ tipo: 'redirecionar', destino: '/login?next=%2F' })
  })

  test('lets anonymous users reach public pages', () => {
    for (const rota of ['/login', '/cadastro', '/recuperar', '/privacidade', '/termos', '/auth/confirmar']) {
      expect(decidirAcesso(rota, '', false)).toEqual({ tipo: 'seguir' })
    }
  })

  test('sends logged users away from login and signup', () => {
    expect(decidirAcesso('/login', '', true)).toEqual({ tipo: 'redirecionar', destino: '/' })
    expect(decidirAcesso('/cadastro', '', true)).toEqual({ tipo: 'redirecionar', destino: '/' })
  })

  test('lets logged users reach private pages, reset password and legal pages', () => {
    for (const rota of ['/', '/clientes/1', '/nova-senha', '/privacidade', '/auth/confirmar']) {
      expect(decidirAcesso(rota, '', true)).toEqual({ tipo: 'seguir' })
    }
  })

  test('does not treat lookalike paths as public', () => {
    expect(decidirAcesso('/loginx', '', false).tipo).toBe('redirecionar')
    expect(decidirAcesso('/privacidade-admin', '', false).tipo).toBe('redirecionar')
  })

  test('payment provider notices reach their route without a session (the route checks the signature)', () => {
    expect(decidirAcesso('/api/pagamentos/aviso/asaas', '', false)).toEqual({ tipo: 'seguir' })
    expect(decidirAcesso('/api/pagamentos/avisoX', '', false).tipo).toBe('redirecionar')
    expect(decidirAcesso('/api/pagamentos/aviso', '', false).tipo).toBe('redirecionar')
    // R65: the public lead form opens without a session, logged in or not
    expect(decidirAcesso('/f/AbCdEfGhIjKlMnOpQrStUvWx', '?o=instagram', false)).toEqual({ tipo: 'seguir' })
    expect(decidirAcesso('/f/AbCdEfGhIjKlMnOpQrStUvWx', '', true)).toEqual({ tipo: 'seguir' })
    expect(decidirAcesso('/f', '', false).tipo).toBe('redirecionar')
    expect(decidirAcesso('/fornecedores', '', false).tipo).toBe('redirecionar')
    // R70: the proposal link opens without a session
    expect(decidirAcesso('/p/AbCdEfGhIjKlMnOpQrStUvWx', '', false)).toEqual({ tipo: 'seguir' })
    expect(decidirAcesso('/p', '', false).tipo).toBe('redirecionar')
    expect(decidirAcesso('/passeios', '', false).tipo).toBe('redirecionar')
  })
})
