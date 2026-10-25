import { describe, expect, it } from 'vitest'
import { mensagemDeErroReserva } from '@/lib/reservas/schema'
import { CATEGORIAS_VEICULO, capacidadeSugerida, rotuloCategoria, veiculoSchema } from './veiculos'

describe('veiculoSchema (R137)', () => {
  it('reads name, category and seats', () => {
    expect(veiculoSchema.parse({ nome: ' Van 01 ', categoria: 'van', lugares: '15' })).toEqual({ nome: 'Van 01', categoria: 'van', lugares: 15 })
  })

  it.each([
    ['no name', { nome: ' ' }],
    ['long name', { nome: 'a'.repeat(81) }],
    ['unknown category', { categoria: 'aviao' }],
    ['zero seats', { lugares: '0' }],
    ['too many seats', { lugares: '501' }],
    ['fractional seats', { lugares: '2.5' }],
  ])('rejects %s', (_n, parcial) => {
    expect(veiculoSchema.safeParse({ nome: 'Van', categoria: 'van', lugares: '10', ...parcial }).success).toBe(false)
  })

  it('names every category in Portuguese', () => {
    expect(CATEGORIAS_VEICULO.map(rotuloCategoria)).toEqual(['Van', 'Ônibus', 'Micro-ônibus', 'Buggy', 'Barco', 'Carro', 'Outro'])
  })
})

describe('capacidadeSugerida (R138)', () => {
  it('fills an empty capacity with the vehicle seats', () => {
    expect(capacidadeSugerida('', null, 15)).toBe('15')
  })

  it('follows the vehicle while the capacity was the old vehicle seats', () => {
    expect(capacidadeSugerida('15', 15, 44)).toBe('44')
  })

  it('never overwrites a capacity the person typed', () => {
    expect(capacidadeSugerida('12', 15, 44)).toBe('12')
    expect(capacidadeSugerida('12', null, 44)).toBe('12')
  })

  it('keeps the capacity when the vehicle is removed', () => {
    expect(capacidadeSugerida('15', 15, null)).toBe('15')
  })
})

it('explains the database refusal when the vehicle is too small', () => {
  expect(mensagemDeErroReserva('CR019')).toMatch(/lugares do veículo/)
})
