import { describe, expect, test } from 'vitest'
import { descreverOrigem, lerCliqueDoLink, mensagemComCodigo, tituloDaChave } from './origens'

describe('lerCliqueDoLink', () => {
  test('reads gclid and tags, trimmed and capped', () => {
    expect(lerCliqueDoLink(new URLSearchParams('gclid= Cj0 &utm_source=google&utm_medium=cpc&utm_campaign=Verao&utm_term=&utm_content=x')))
      .toEqual({ gclid: 'Cj0', utmFonte: 'google', utmMidia: 'cpc', utmCampanha: 'Verao', utmTermo: null, utmConteudo: 'x' })
    expect(lerCliqueDoLink(new URLSearchParams(`gclid=${'g'.repeat(300)}&utm_campaign=${'c'.repeat(150)}`))).toMatchObject({ gclid: 'g'.repeat(255), utmCampanha: 'c'.repeat(100) })
  })
})

describe('mensagemComCodigo', () => {
  test('appends the short code the database looks for', () => {
    expect(mensagemComCodigo('Olá! Quero saber dos passeios.', 'K7Q2M')).toBe('Olá! Quero saber dos passeios. (cód. K7Q2M)')
  })
})

describe('descreverOrigem', () => {
  test('Meta ad through WhatsApp', () => {
    expect(descreverOrigem({ canal: 'meta', via: 'whatsapp', campanha: null, anuncio_titulo: 'Gramado no inverno', anuncio_id: '120200' }))
      .toEqual({ titulo: 'Anúncio no Meta (Facebook/Instagram)', detalhe: 'Anúncio "Gramado no inverno" · chegou pelo WhatsApp' })
  })
  test('Google click through WhatsApp and form without campaign', () => {
    expect(descreverOrigem({ canal: 'google', via: 'whatsapp', campanha: 'verao 2027', anuncio_titulo: null, anuncio_id: null }).detalhe).toBe('Campanha "verao 2027" · chegou pelo WhatsApp')
    expect(descreverOrigem({ canal: 'outro', via: 'formulario', campanha: null, anuncio_titulo: null, anuncio_id: null }))
      .toEqual({ titulo: 'Link com etiqueta de campanha', detalhe: 'Sem campanha informada · chegou pelo formulário' })
  })
})

describe('tituloDaChave', () => {
  test('names a campaign row from what is known', () => {
    expect(tituloDaChave({ nome: 'Verão', titulo: null, chave: 'verao' })).toBe('Verão')
    expect(tituloDaChave({ nome: null, titulo: 'Gramado no inverno', chave: 'anuncio:120200' })).toBe('Anúncio "Gramado no inverno"')
    expect(tituloDaChave({ nome: null, titulo: null, chave: 'anuncio:120200' })).toBe('Anúncio 120200')
    expect(tituloDaChave({ nome: null, titulo: null, chave: 'canal:google' })).toBe('Sem campanha informada')
    expect(tituloDaChave({ nome: null, titulo: null, chave: 'verao 2027' })).toBe('Campanha "verao 2027"')
    expect(tituloDaChave({ nome: null, titulo: null, chave: null })).toBe('Origem não identificada')
  })
})
