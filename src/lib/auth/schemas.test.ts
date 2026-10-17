import { describe, expect, test } from 'vitest'
import { cadastroSchema, loginSchema, novaSenhaSchema, recuperarSchema } from './schemas'

const cadastroValido = {
  nome: 'Ana Dona',
  agenciaNome: 'Agência Alfa',
  email: 'dono@alfa.com.br',
  senha: 'abcd1234',
  aceite: 'on',
}

describe('cadastroSchema', () => {
  test('accepts a valid signup', () => {
    expect(cadastroSchema.safeParse(cadastroValido).success).toBe(true)
  })

  test('normalizes email to lowercase and trims the agency name', () => {
    const r = cadastroSchema.parse({ ...cadastroValido, email: ' Dono@Alfa.COM.br ', agenciaNome: '  Alfa  ' })
    expect(r.email).toBe('dono@alfa.com.br')
    expect(r.agenciaNome).toBe('Alfa')
  })

  test.each([
    ['short password', { senha: 'ab1' }],
    ['password without digits', { senha: 'abcdefgh' }],
    ['password without letters', { senha: '12345678' }],
    ['invalid email', { email: 'nao-e-email' }],
    ['empty agency name', { agenciaNome: '   ' }],
    ['empty user name', { nome: '   ' }],
    ['user name too long', { nome: 'a'.repeat(81) }],
    ['agency name too long', { agenciaNome: 'a'.repeat(121) }],
    ['terms not accepted', { aceite: undefined }],
  ])('rejects %s', (_nome, parcial) => {
    expect(cadastroSchema.safeParse({ ...cadastroValido, ...parcial }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  test('requires email and password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', senha: 'x' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: 'a@b.co', senha: '' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'x', senha: 'x' }).success).toBe(false)
  })
})

describe('recuperarSchema', () => {
  test('requires a valid email', () => {
    expect(recuperarSchema.safeParse({ email: 'a@b.co' }).success).toBe(true)
    expect(recuperarSchema.safeParse({ email: '' }).success).toBe(false)
  })
})

describe('novaSenhaSchema', () => {
  test('requires matching strong passwords', () => {
    expect(novaSenhaSchema.safeParse({ senha: 'abcd1234', confirmacao: 'abcd1234' }).success).toBe(true)
    expect(novaSenhaSchema.safeParse({ senha: 'abcd1234', confirmacao: 'abcd9999' }).success).toBe(false)
    expect(novaSenhaSchema.safeParse({ senha: 'abc', confirmacao: 'abc' }).success).toBe(false)
  })
})
