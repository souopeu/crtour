import { describe, expect, test } from 'vitest'
import { montarCsvPassageiros, montarLista, passageiroSchema, type ReservaDaLista } from './lista'

const reservas: ReservaDaLista[] = [
  { id: 'r1', cliente_nome: 'Ana Souza', cliente_whatsapp: '5511999990001', qtd_pessoas: 3, situacao: 'ativa' },
  { id: 'r2', cliente_nome: 'Beto Lima', cliente_whatsapp: null, qtd_pessoas: 1, situacao: 'ativa' },
  { id: 'r3', cliente_nome: 'Cancelado', cliente_whatsapp: '5511999990003', qtd_pessoas: 2, situacao: 'cancelada' },
]
const passageiros = [{ reserva_id: 'r1', nome: 'Maria Silva', whatsapp: '5511988880000' }]

describe('montarLista', () => {
  test('lists the responsible first, then companions, then unnamed places; skips cancelled reservations', () => {
    const lista = montarLista(reservas, passageiros)
    expect(lista.map((l) => [l.numero, l.nome, l.tipo, l.reserva])).toEqual([
      [1, 'Ana Souza', 'Responsável', 'Ana Souza'],
      [2, 'Maria Silva', 'Acompanhante', 'Ana Souza'],
      [3, '(nome a informar)', 'Acompanhante', 'Ana Souza'],
      [4, 'Beto Lima', 'Responsável', 'Beto Lima'],
    ])
  })

  test('the list always adds up to the people reserved', () => {
    expect(montarLista(reservas, passageiros)).toHaveLength(4) // 3 + 1, the cancelled one (2) is not counted
  })

  test('formats phones and flags unnamed places', () => {
    const lista = montarLista(reservas, passageiros)
    expect(lista[0].telefone).toBe('(11) 99999-0001')
    expect(lista[1].telefone).toBe('(11) 98888-0000')
    expect(lista[2].telefone).toBe('')
    expect(lista[2].semNome).toBe(true)
    expect(lista[0].semNome).toBe(false)
  })

  test('ignores companions of cancelled or unknown reservations', () => {
    const lista = montarLista(reservas, [...passageiros, { reserva_id: 'r3', nome: 'Fantasma', whatsapp: null }])
    expect(lista.some((l) => l.nome === 'Fantasma')).toBe(false)
  })

  test('an empty list is fine', () => {
    expect(montarLista([], [])).toEqual([])
  })
})

describe('montarCsvPassageiros', () => {
  test('writes the guide sheet and neutralizes formulas', () => {
    const csv = montarCsvPassageiros(montarLista([{ ...reservas[1], cliente_nome: '=cmd' }], []))
    expect(csv).toBe("﻿Nº;Nome;Tipo;WhatsApp;Reserva\r\n1;'=cmd;Responsável;;'=cmd\r\n")
  })
})

describe('passageiroSchema', () => {
  test('normalizes the phone and reads the checkbox', () => {
    expect(passageiroSchema.parse({ nome: '  Maria Silva ', whatsapp: '(11) 98888-0000', cadastrar: 'on' })).toEqual({
      nome: 'Maria Silva', whatsapp: '5511988880000', criar_cliente: true,
    })
    expect(passageiroSchema.parse({ nome: 'João', whatsapp: '', cadastrar: undefined })).toEqual({
      nome: 'João', whatsapp: null, criar_cliente: false,
    })
  })
  test.each([
    ['blank name', { nome: '  ', whatsapp: '' }],
    ['long name', { nome: 'a'.repeat(201), whatsapp: '' }],
    ['bad phone', { nome: 'A', whatsapp: '123' }],
  ])('rejects %s', (_n, dados) => {
    expect(passageiroSchema.safeParse({ cadastrar: undefined, ...dados }).success).toBe(false)
  })
})
