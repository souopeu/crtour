import { describe, expect, test } from 'vitest'
import { estadoDoBotao, linkWhatsapp, mensagemPadrao, primeiroNome } from './whatsappLink'

describe('linkWhatsapp', () => {
  test('builds a wa.me link with the encoded message', () => {
    expect(linkWhatsapp('5511999999999', 'Olá, Ana!')).toBe('https://wa.me/5511999999999?text=Ol%C3%A1%2C%20Ana!')
  })

  test('omits the text when the message is blank', () => {
    expect(linkWhatsapp('5511999999999', '   ')).toBe('https://wa.me/5511999999999')
  })

  test('encodes line breaks and query-string characters (no parameter injection)', () => {
    const link = linkWhatsapp('5511999999999', 'linha 1\nlinha 2&text=evil#x')!
    expect(link).toContain('%0A')
    expect(link).toContain('%26text%3Devil%23x')
    expect(new URL(link).searchParams.get('text')).toBe('linha 1\nlinha 2&text=evil#x')
  })

  test('limits the message length', () => {
    const link = linkWhatsapp('5511999999999', 'a'.repeat(5000))!
    expect(new URL(link).searchParams.get('text')).toHaveLength(1000)
  })

  test.each([null, undefined, '', '123', 'abc', '55 11 99999-9999', '5511999999999/evil'])('returns null for number %j', (n) => {
    expect(linkWhatsapp(n, 'oi')).toBeNull()
  })
})

describe('estadoDoBotao', () => {
  test('is disabled without a number', () => {
    expect(estadoDoBotao(null, 'aceitou')).toEqual({ habilitado: false, motivo: 'sem_numero' })
  })
  test('is disabled for who asked to stop receiving messages', () => {
    expect(estadoDoBotao('5511999999999', 'pediu_saida')).toEqual({ habilitado: false, motivo: 'pediu_saida' })
  })
  test('is enabled when the client accepted', () => {
    expect(estadoDoBotao('5511999999999', 'aceitou')).toEqual({ habilitado: true, aviso: null })
  })
  test('is enabled but warns when consent is unknown', () => {
    expect(estadoDoBotao('5511999999999', 'nao_informado')).toEqual({ habilitado: true, aviso: 'sem_consentimento' })
  })
  test('no number wins over opt-out', () => {
    expect(estadoDoBotao(null, 'pediu_saida').habilitado).toBe(false)
  })
})

describe('mensagemPadrao', () => {
  test('greets by first name', () => {
    expect(primeiroNome('  Ana Souza ')).toBe('Ana')
    expect(mensagemPadrao('Ana Souza')).toBe('Olá, Ana! Tudo bem?')
  })
  test('works without a name', () => {
    expect(mensagemPadrao('  ')).toBe('Olá! Tudo bem?')
  })
})
