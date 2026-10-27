import { describe, expect, test } from 'vitest'
import { dadosVoucherSchema, lerFormVoucher, listaDePassageiros, mensagemVoucher, montarDados, reservaQuitada } from './voucher'

const fd = (campos: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

describe('lerFormVoucher', () => {
  test('reads meeting point, time and notes, trimmed', () => {
    const r = lerFormVoucher(fd({ encontro: ' Praça da Sé ', horario: '07:30', observacoes: ' Leve documento ' }))
    expect(r).toEqual({ ok: true, dados: { encontro: 'Praça da Sé', horario: '07:30', observacoes: 'Leve documento' } })
  })
  test('every field is optional', () => {
    expect(lerFormVoucher(fd({}))).toEqual({ ok: true, dados: { encontro: null, horario: null, observacoes: null } })
  })
  test('explains each problem', () => {
    const r = lerFormVoucher(fd({ encontro: 'x'.repeat(201), horario: '25:99', observacoes: 'y'.repeat(1001) }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.campos).sort()).toEqual(['encontro', 'horario', 'observacoes'])
  })
})

describe('reservaQuitada', () => {
  test('only an active reservation with money paid and no balance', () => {
    expect(reservaQuitada({ situacao: 'ativa', pago_centavos: 1000, saldo_centavos: 0 })).toBe(true)
    expect(reservaQuitada({ situacao: 'ativa', pago_centavos: 1000, saldo_centavos: 1 })).toBe(false)
    expect(reservaQuitada({ situacao: 'ativa', pago_centavos: 0, saldo_centavos: 0 })).toBe(false)
    expect(reservaQuitada({ situacao: 'cancelada', pago_centavos: 1000, saldo_centavos: 0 })).toBe(false)
  })
})

describe('listaDePassageiros', () => {
  test('responsible first, named companions, then places still without a name', () => {
    expect(listaDePassageiros('Ana', ['Bia'], 4)).toEqual(['Ana', 'Bia', '(nome a informar)', '(nome a informar)'])
  })
  test('never lists more people than the reservation holds', () => {
    expect(listaDePassageiros('Ana', ['Bia', 'Caio'], 2)).toEqual(['Ana', 'Bia'])
  })
})

describe('montarDados / mensagemVoucher', () => {
  test('snapshot joins form and context', () => {
    const d = montarDados(
      { encontro: 'Praça', horario: '07:30', observacoes: null },
      { agencia: 'Alfa', cliente: 'Ana', passeio: 'Lisboa', destino: 'Portugal', saida: '2027-03-10', inclui: null, pessoas: 2, passageiros: ['Ana', 'Bia'] },
    )
    expect(d).toMatchObject({ agencia: 'Alfa', encontro: 'Praça', horario: '07:30', passageiros: ['Ana', 'Bia'], extras: [] })
  })
  test('extras sold go in the snapshot; vouchers issued before extras still read (R158)', () => {
    const c = { agencia: 'Alfa', cliente: 'Ana', passeio: 'Lisboa', destino: null, saida: '2027-03-10', inclui: null, pessoas: 2, passageiros: ['Ana', 'Bia'] }
    const d = montarDados({ encontro: null, horario: null, observacoes: null }, { ...c, extras: ['2 × Almoço'] })
    expect(dadosVoucherSchema.parse(d).extras).toEqual(['2 × Almoço'])
    expect(dadosVoucherSchema.parse({ ...c, encontro: null, horario: null, observacoes: null }).extras).toEqual([])
  })
  test('message greets by first name and carries the link', () => {
    expect(mensagemVoucher('Ana Souza', 'https://x.com/v/abc', 'Lisboa')).toBe('Olá, Ana! Segue o voucher do passeio Lisboa: https://x.com/v/abc')
  })
})
