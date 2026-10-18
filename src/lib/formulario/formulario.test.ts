import { describe, expect, test } from 'vitest'
import { hashVisitante, lerEnvio, lerOrigemDoLink, linkDoFormulario } from './formulario'

const fd = (campos: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

describe('lerEnvio', () => {
  test('accepts the minimum (name and WhatsApp) and normalizes the number', () => {
    const r = lerEnvio(fd({ nome: '  Maria  ', whatsapp: '(11) 99999-0001' }))
    expect(r).toEqual({ ok: true, dados: { nome: 'Maria', whatsapp: '5511999990001', destino: null, pessoas: null, data: null, mensagem: null, aceita: false } })
  })
  test('reads the optional fields', () => {
    const r = lerEnvio(fd({ nome: 'Ana', whatsapp: '11999990002', destino: 'Lisboa', pessoas: '2', data: '2027-03-10', mensagem: 'Oi', aceita: 'on' }))
    expect(r.ok && r.dados).toMatchObject({ destino: 'Lisboa', pessoas: 2, data: '2027-03-10', mensagem: 'Oi', aceita: true })
  })
  test('explains each problem in Portuguese', () => {
    const r = lerEnvio(fd({ nome: '', whatsapp: '123', pessoas: '0', data: '10/03/2027', mensagem: 'x'.repeat(1001) }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.campos.nome).toBe('Digite seu nome.')
      expect(r.campos.whatsapp).toBe('Digite um WhatsApp com DDD, como (11) 99999-0000.')
      expect(r.campos.pessoas).toBeDefined()
      expect(r.campos.data).toBeDefined()
      expect(r.campos.mensagem).toBeDefined()
    }
  })
  test('R68: a filled bait field is a robot', () => {
    expect(lerEnvio(fd({ nome: 'Ana', whatsapp: '11999990002', site: 'http://spam' }))).toEqual({ ok: false, robo: true, campos: {} })
  })
})

describe('lerOrigemDoLink', () => {
  test('R66: known origin and campaign tags from the link', () => {
    expect(lerOrigemDoLink({ o: 'instagram', utm_source: 'ig', utm_campaign: 'verao' })).toEqual({ origem: 'instagram', utmFonte: 'ig', utmCampanha: 'verao' })
  })
  test('no or unknown origin is "site"; tags are trimmed and capped', () => {
    expect(lerOrigemDoLink({})).toEqual({ origem: 'site', utmFonte: null, utmCampanha: null })
    expect(lerOrigemDoLink({ o: 'tv', utm_source: ` ${'a'.repeat(150)} ` }).origem).toBe('site')
    expect(lerOrigemDoLink({ utm_source: 'a'.repeat(150) }).utmFonte).toHaveLength(100)
    expect(lerOrigemDoLink({ o: ['instagram', 'x'] }).origem).toBe('site')
  })
})

describe('hashVisitante', () => {
  test('never keeps the raw IP and differs per form', () => {
    const h = hashVisitante('200.1.2.3', 'codigoA')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).not.toContain('200.1.2.3')
    expect(hashVisitante('200.1.2.3', 'codigoB')).not.toBe(h)
  })
})

describe('linkDoFormulario', () => {
  test('builds the public link with an optional origin', () => {
    expect(linkDoFormulario('https://crtour.app', 'ABC123', null)).toBe('https://crtour.app/f/ABC123')
    expect(linkDoFormulario('https://crtour.app', 'ABC123', 'instagram')).toBe('https://crtour.app/f/ABC123?o=instagram')
  })
})
