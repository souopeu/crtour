import { describe, expect, test } from 'vitest'
import { descreverSugestao, sugestaoSchema } from './sugestoes'

const base = { id: '8f14e45f-ceea-4672-9d1b-9f1c2c3d4e5f', cliente_id: '9f14e45f-ceea-4672-9d1b-9f1c2c3d4e5f', campo: 'cidade', valor_sugerido: 'Campinas' }

describe('sugestaoSchema', () => {
  test('accepts a known field', () => {
    expect(sugestaoSchema.parse(base).campo).toBe('cidade')
  })
  test('rejects an unknown field', () => {
    expect(sugestaoSchema.safeParse({ ...base, campo: 'whatsapp' }).success).toBe(false)
  })
})

describe('descreverSugestao', () => {
  test('formats dates as dd/mm/aaaa', () => {
    expect(descreverSugestao('aniversario', '1990-05-17')).toEqual({ rotulo: 'Aniversário', valor: '17/05/1990' })
  })
  test('shows the origin label', () => {
    expect(descreverSugestao('origem', 'indicacao').valor).toBe('Indicação')
  })
  test('keeps plain text as is', () => {
    expect(descreverSugestao('cidade', 'Santos')).toEqual({ rotulo: 'Cidade', valor: 'Santos' })
  })
})
