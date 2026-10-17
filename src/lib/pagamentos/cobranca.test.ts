import { describe, expect, test } from 'vitest'
import {
  criarPagamentoSchema, diasAte, mensagemCobranca, passaFiltro, situacaoCobranca, totalSchema, vencimentoSchema,
} from './cobranca'

const hoje = '2026-10-17'

describe('diasAte', () => {
  test('counts calendar days, across months and years', () => {
    expect(diasAte('2026-10-17', hoje)).toBe(0)
    expect(diasAte('2026-10-24', hoje)).toBe(7)
    expect(diasAte('2026-10-10', hoje)).toBe(-7)
    expect(diasAte('2027-01-01', hoje)).toBe(76)
  })
})

describe('situacaoCobranca', () => {
  test.each([
    [0, '2020-01-01', 'quitada'],
    [-5, null, 'quitada'],
    [1000, null, 'sem_vencimento'],
    [1000, '2026-10-16', 'vencida'],
    [1000, '2026-10-17', 'a_vencer'],
    [1000, '2026-11-30', 'a_vencer'],
  ])('balance %i due %s -> %s', (saldo, venc, esperado) => {
    expect(situacaoCobranca(saldo, venc, hoje)).toBe(esperado)
  })
})

describe('passaFiltro', () => {
  const vencida = { saldo: 100, vencimento: '2026-10-01' }
  const proxima = { saldo: 100, vencimento: '2026-10-20' }
  const longe = { saldo: 100, vencimento: '2026-12-20' }
  const sem = { saldo: 100, vencimento: null }
  const quitada = { saldo: 0, vencimento: '2026-10-01' }
  test('todas keeps everything that still has a balance', () => {
    expect([vencida, proxima, longe, sem, quitada].filter((i) => passaFiltro(i, 'todas', hoje))).toHaveLength(4)
  })
  test('vencidas', () => {
    expect([vencida, proxima, sem, quitada].filter((i) => passaFiltro(i, 'vencidas', hoje))).toEqual([vencida])
  })
  test('proximos7 includes today and the 7th day, not the 8th', () => {
    expect(passaFiltro({ saldo: 1, vencimento: '2026-10-17' }, 'proximos7', hoje)).toBe(true)
    expect(passaFiltro({ saldo: 1, vencimento: '2026-10-24' }, 'proximos7', hoje)).toBe(true)
    expect(passaFiltro({ saldo: 1, vencimento: '2026-10-25' }, 'proximos7', hoje)).toBe(false)
    expect(passaFiltro(vencida, 'proximos7', hoje)).toBe(false)
  })
  test('sem_vencimento', () => {
    expect([vencida, sem].filter((i) => passaFiltro(i, 'sem_vencimento', hoje))).toEqual([sem])
  })
})

describe('mensagemCobranca', () => {
  test('mentions the balance, the trip and the due date', () => {
    expect(mensagemCobranca({ nome: 'Ana Souza', saldoCentavos: 150000, vencimento: '2027-02-01', passeio: 'Lisboa clássica', dataSaida: '2027-03-10' }))
      .toBe('Olá, Ana! Tudo bem? Passando para lembrar do saldo de R$ 1.500,00 da sua viagem Lisboa clássica (saída em 10/03/2027), com vencimento em 01/02/2027. Qualquer dúvida, estou à disposição.')
  })
  test('omits the due date when there is none', () => {
    const m = mensagemCobranca({ nome: 'Ana', saldoCentavos: 5000, vencimento: null, passeio: 'X', dataSaida: '2027-03-10' })
    expect(m).not.toContain('vencimento')
    expect(m).toContain('R$ 50,00')
  })
})

describe('criarPagamentoSchema', () => {
  const schema = criarPagamentoSchema(hoje)
  const ok = { valor: '500,00', tipo: 'sinal', forma: 'pix', data: '2026-10-17', observacao: ' pix do marido ' }
  test('converts amount and trims the note', () => {
    expect(schema.parse(ok)).toEqual({ valor_centavos: 50000, tipo: 'sinal', forma: 'pix', data: '2026-10-17', observacao: 'pix do marido' })
  })
  test.each([
    ['zero', { valor: '0' }],
    ['empty', { valor: '' }],
    ['not a number', { valor: 'cem' }],
    ['refund type', { tipo: 'estorno' }],
    ['unknown type', { tipo: 'doação' }],
    ['unknown way', { forma: 'cheque' }],
    ['future date', { data: '2026-10-18' }],
    ['bad date', { data: '2026-02-31' }],
    ['long note', { observacao: 'a'.repeat(501) }],
  ])('rejects %s', (_n, parcial) => {
    expect(schema.safeParse({ ...ok, ...parcial }).success).toBe(false)
  })
})

describe('vencimentoSchema and totalSchema', () => {
  test('due date may be cleared or a valid date', () => {
    expect(vencimentoSchema.parse({ data: '' }).data).toBeNull()
    expect(vencimentoSchema.parse({ data: '2027-02-01' }).data).toBe('2027-02-01')
    expect(vencimentoSchema.safeParse({ data: '01/02/2027' }).success).toBe(false)
  })
  test('total accepts zero and rejects junk', () => {
    expect(totalSchema.parse({ valor: '1.500,00' }).valor_total_centavos).toBe(150000)
    expect(totalSchema.parse({ valor: '0' }).valor_total_centavos).toBe(0)
    expect(totalSchema.safeParse({ valor: '' }).success).toBe(false)
  })
})
