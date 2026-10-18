import { describe, expect, test } from 'vitest'
import { conviteSchema, gerarToken, hashToken, linkDoConvite, tokenSchema } from './equipe'

describe('gerarToken / hashToken', () => {
  test('random, URL-safe, and accepted by the token schema', () => {
    const a = gerarToken()
    const b = gerarToken()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(tokenSchema.safeParse(a).success).toBe(true)
  })
  test('SHA-256 hex, same as the database (encode(digest(token, sha256), hex))', () => {
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('tokenSchema', () => {
  test.each(['', 'curto', 'tem espaço aqui e ali 1234567890', 'x'.repeat(101), '<script>alert(1)</script>xxxxxxx'])('refuses %j', (t) => {
    expect(tokenSchema.safeParse(t).success).toBe(false)
  })
})

describe('conviteSchema', () => {
  test('trims the name and lower-cases the e-mail', () => {
    expect(conviteSchema.parse({ nome: '  Vera ', email: ' Vera@Test.DEV ' })).toEqual({ nome: 'Vera', email: 'vera@test.dev' })
  })
  test('messages', () => {
    const r = conviteSchema.safeParse({ nome: '', email: 'nope' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors).toEqual({ nome: ['Digite o nome da pessoa.'], email: ['Digite um e-mail válido.'] })
  })
})

describe('linkDoConvite', () => {
  test('signup link with the token and the e-mail, encoded', () => {
    expect(linkDoConvite('https://app.crtour.com.br', 'abc_DEF-123', 'vera+1@test.dev'))
      .toBe('https://app.crtour.com.br/cadastro?convite=abc_DEF-123&email=vera%2B1%40test.dev')
  })
})
