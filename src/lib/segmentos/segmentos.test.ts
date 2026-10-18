import { describe, expect, test } from 'vitest'
import { aplicarModelo, criteriosParaQuery, descreverCriterios, lerCriterios, segmentoSchema, separarFila } from './segmentos'

const UUID = '6f1c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f'

describe('lerCriterios', () => {
  test('keeps only valid, non-empty criteria, trimmed', () => {
    expect(lerCriterios({
      etiqueta: UUID, destino: '  Lisboa ', origem: 'instagram', cidade: ' São Paulo ', aniversarioMes: '3',
      semContatoDias: '30', motivoPerda: 'achou_caro', passaporteMeses: '6', outro: 'x',
    })).toEqual({ etiqueta: UUID, destino: 'Lisboa', origem: 'instagram', cidade: 'São Paulo', aniversarioMes: 3, semContatoDias: 30, motivoPerda: 'achou_caro', passaporteMeses: 6 })
  })
  test('invalid values are ignored, never an error', () => {
    expect(lerCriterios({
      etiqueta: 'nope', destino: '', origem: 'tv', cidade: '   ', aniversarioMes: '13', semContatoDias: '0', motivoPerda: 'medo', passaporteMeses: '2.5',
    })).toEqual({})
    expect(lerCriterios({ aniversarioMes: ['3', '4'], destino: 'x'.repeat(81) })).toEqual({})
  })
  test('accepts numbers as saved in the database', () => {
    expect(lerCriterios({ aniversarioMes: 3, semContatoDias: 30, destino: 7 })).toEqual({ aniversarioMes: 3, semContatoDias: 30, destino: '7' })
  })
  test('limits', () => {
    expect(lerCriterios({ aniversarioMes: '12', semContatoDias: '365', passaporteMeses: '24' })).toEqual({ aniversarioMes: 12, semContatoDias: 365, passaporteMeses: 24 })
    expect(lerCriterios({ semContatoDias: '366', passaporteMeses: '25', aniversarioMes: '0' })).toEqual({})
  })
})

describe('criteriosParaQuery', () => {
  test('round-trips through lerCriterios', () => {
    const c = { destino: 'Porto & Lisboa', aniversarioMes: 3, origem: 'site' as const }
    const q = criteriosParaQuery(c)
    expect(lerCriterios(Object.fromEntries(new URLSearchParams(q)))).toEqual(c)
  })
  test('empty criteria give an empty string', () => {
    expect(criteriosParaQuery({})).toBe('')
  })
})

describe('descreverCriterios', () => {
  test('one readable line per criterion', () => {
    expect(descreverCriterios(
      { etiqueta: UUID, destino: 'Lisboa', origem: 'indicacao', cidade: 'Santos', aniversarioMes: 3, semContatoDias: 30, motivoPerda: 'achou_caro', passaporteMeses: 6 },
      new Map([[UUID, 'VIP']]),
    )).toEqual([
      'Etiqueta: VIP', 'Destino de interesse: Lisboa', 'Como conheceu: Indicação', 'Cidade: Santos', 'Aniversário em março',
      'Sem contato há 30 dias ou mais', 'Perdeu negociação por: Achou caro', 'Passaporte vence em até 6 meses (ou já venceu)',
    ])
  })
  test('unknown tag and no criteria', () => {
    expect(descreverCriterios({ etiqueta: UUID }, new Map())).toEqual(['Etiqueta: (apagada)'])
    expect(descreverCriterios({}, new Map())).toEqual(['Todos os clientes'])
  })
})

describe('aplicarModelo', () => {
  test('first name and destination', () => {
    expect(aplicarModelo('Oi {nome}! Novidades de {destino} 😊', { nome: 'Ana Maria Souza', destino: 'Lisboa' })).toBe('Oi Ana! Novidades de Lisboa 😊')
  })
  test('every occurrence; fallback when there is no destination', () => {
    expect(aplicarModelo('{nome}, {nome}: {destino}', { nome: 'Bia', destino: null })).toBe('Bia, Bia: sua próxima viagem')
  })
  test('unknown variables stay as typed', () => {
    expect(aplicarModelo('Oi {apelido}', { nome: 'Bia', destino: null })).toBe('Oi {apelido}')
  })
})

describe('separarFila', () => {
  const c = (id: string, consentimento_whatsapp: string, whatsapp: string | null = '5511999990001') => ({ id, whatsapp, consentimento_whatsapp })
  test('only "aceitou" with a number gets a button; already called this round are apart', () => {
    const r = separarFila([c('a', 'aceitou'), c('b', 'aceitou'), c('c', 'nao_informado'), c('d', 'pediu_saida'), c('e', 'aceitou', null)], new Set(['b']))
    expect(r.paraChamar.map((x) => x.id)).toEqual(['a'])
    expect(r.jaChamados.map((x) => x.id)).toEqual(['b'])
    expect(r.semConsentimento.map((x) => x.id)).toEqual(['c', 'd'])
    expect(r.semNumero.map((x) => x.id)).toEqual(['e'])
  })
  test('someone who was called and later asked to leave is shown as called, never as a button', () => {
    const r = separarFila([c('a', 'pediu_saida')], new Set(['a']))
    expect(r.jaChamados.map((x) => x.id)).toEqual(['a'])
    expect(r.paraChamar).toEqual([])
  })
})

describe('segmentoSchema', () => {
  test('name required, message up to 1000', () => {
    expect(segmentoSchema.parse({ nome: '  Lisboa  ', mensagem: ' Oi {nome} ' })).toEqual({ nome: 'Lisboa', mensagem: 'Oi {nome}' })
    const r = segmentoSchema.safeParse({ nome: ' ', mensagem: 'x'.repeat(1001) })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.flatten().fieldErrors).toEqual({
        nome: ['Dê um nome ao segmento.'], mensagem: ['A mensagem pode ter no máximo 1000 caracteres.'],
      })
    }
  })
  test('name up to 80', () => {
    expect(segmentoSchema.safeParse({ nome: 'x'.repeat(81), mensagem: '' }).success).toBe(false)
  })
})

describe('viajouPara (R42)', () => {
  test('read, kept in the URL and described', () => {
    const c = lerCriterios({ viajouPara: '  Lisboa ', destino: 'Porto' })
    expect(c).toEqual({ destino: 'Porto', viajouPara: 'Lisboa' })
    expect(lerCriterios(Object.fromEntries(new URLSearchParams(criteriosParaQuery(c))))).toEqual(c)
    expect(descreverCriterios(c, new Map())).toEqual(['Destino de interesse: Porto', 'Já viajou para: Lisboa'])
  })
  test('empty or too long is ignored', () => {
    expect(lerCriterios({ viajouPara: '   ' })).toEqual({})
    expect(lerCriterios({ viajouPara: 'x'.repeat(81) })).toEqual({})
  })
})
