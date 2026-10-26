import { describe, expect, it } from 'vitest'
import {
  CATEGORIAS_CONTA, contaSchema, filtrarAPagar, lerFiltroAPagar, pagarSchema, rotuloCategoriaConta, situacaoAPagar, textoParcela, type LinhaAPagar,
} from './contas'

const HOJE = '2026-10-26'
const FORN = '5b3f1c2a-1d2e-4f50-8a6b-7c8d9e0f1a2b'
const base = { descricao: ' Aluguel ', categoria: 'aluguel', valor: '2.500,00', vencimento: '2026-11-10', fornecedor: '', observacao: '', modo: 'unica', parcelas: '' }

describe('contaSchema (R145–R147)', () => {
  it('reads a single bill into the arguments of criar_conta_pagar', () => {
    expect(contaSchema.parse(base)).toEqual({
      p_descricao: 'Aluguel', p_categoria: 'aluguel', p_valor: 250000, p_vencimento: '2026-11-10',
      p_fornecedor: null, p_observacao: null, p_parcelas: 1, p_recorrente: false,
    })
  })

  it('reads instalments and a monthly series', () => {
    expect(contaSchema.parse({ ...base, modo: 'parcelada', parcelas: '6', fornecedor: FORN })).toMatchObject({ p_parcelas: 6, p_recorrente: false, p_fornecedor: FORN })
    expect(contaSchema.parse({ ...base, modo: 'recorrente', parcelas: '6' })).toMatchObject({ p_parcelas: 1, p_recorrente: true })
  })

  it.each([
    ['no description', { descricao: ' ' }],
    ['unknown category', { categoria: 'lazer' }],
    ['zero value', { valor: '0' }],
    ['bad date', { vencimento: '2026-02-30' }],
    ['instalments out of range', { modo: 'parcelada', parcelas: '1' }],
    ['too many instalments', { modo: 'parcelada', parcelas: '61' }],
    ['a supplier that is not an id', { fornecedor: 'Zé' }],
    ['value smaller than the instalments (less than 1 cent each)', { modo: 'parcelada', parcelas: '3', valor: '0,02' }],
  ])('rejects %s', (_n, parcial) => {
    expect(contaSchema.safeParse({ ...base, ...parcial }).success).toBe(false)
  })

  it('names the seven categories', () => {
    expect(CATEGORIAS_CONTA.map(rotuloCategoriaConta)).toEqual(['Aluguel', 'Pessoal', 'Marketing', 'Sistemas', 'Impostos', 'Transporte', 'Outros'])
  })
})

describe('pagarSchema', () => {
  it('needs a date that is not in the future and a payment form', () => {
    const p = pagarSchema(HOJE)
    expect(p.parse({ data: HOJE, forma: 'pix' })).toEqual({ pago_em: HOJE, forma_pago: 'pix' })
    expect(p.safeParse({ data: '2026-10-27', forma: 'pix' }).success).toBe(false)
    expect(p.safeParse({ data: HOJE, forma: 'cheque' }).success).toBe(false)
  })
})

describe('lista A pagar (R148)', () => {
  const l = (id: string, extra: Partial<LinhaAPagar> = {}): LinhaAPagar => ({
    origem: 'conta', id, descricao: id, categoria: 'Outros', valor: 1000, vencimento: '2026-11-01', pagoEm: null,
    fornecedor: null, parcela: null, href: `/financeiro/contas/${id}`, ...extra,
  })
  const linhas = [
    l('vencida', { vencimento: '2026-10-20' }),
    l('hoje', { vencimento: HOJE }),
    l('semana', { vencimento: '2026-11-02' }),
    l('longe', { vencimento: '2027-03-01' }),
    l('paga', { vencimento: '2026-10-01', pagoEm: '2026-10-01' }),
    l('custo-sem-data', { origem: 'custo', vencimento: null, categoria: 'Custos das saídas' }),
  ]

  it('tells the situation of each line', () => {
    expect(linhas.map((x) => situacaoAPagar(x, HOJE))).toEqual(['vencida', 'proxima', 'proxima', 'a_pagar', 'paga', 'a_pagar'])
  })

  it('shows everything still to pay by default, with no month limit, due date first and undated last', () => {
    expect(filtrarAPagar(linhas, { filtro: 'a_pagar', categoria: null, de: null, ate: null }, HOJE).map((x) => x.id))
      .toEqual(['vencida', 'hoje', 'semana', 'longe', 'custo-sem-data'])
  })

  it.each([
    ['vencidas', ['vencida']],
    ['proximos7', ['hoje', 'semana']],
    ['pagas', ['paga']],
    ['todas', ['paga', 'vencida', 'hoje', 'semana', 'longe', 'custo-sem-data']],
  ] as const)('filters %s', (filtro, esperado) => {
    expect(filtrarAPagar(linhas, { filtro, categoria: null, de: null, ate: null }, HOJE).map((x) => x.id)).toEqual(esperado)
  })

  it('narrows by category and due-date period', () => {
    expect(filtrarAPagar(linhas, { filtro: 'todas', categoria: 'Custos das saídas', de: null, ate: null }, HOJE).map((x) => x.id)).toEqual(['custo-sem-data'])
    expect(filtrarAPagar(linhas, { filtro: 'a_pagar', categoria: null, de: '2026-11-01', ate: '2026-11-30' }, HOJE).map((x) => x.id)).toEqual(['semana'])
  })

  it('reads the filters from the address, ignoring anything unknown', () => {
    expect(lerFiltroAPagar({})).toEqual({ filtro: 'a_pagar', categoria: null, de: null, ate: null })
    expect(lerFiltroAPagar({ filtro: 'pagas', categoria: 'Aluguel', de: '2026-11-01', ate: 'x' })).toEqual({ filtro: 'pagas', categoria: 'Aluguel', de: '2026-11-01', ate: null })
    expect(lerFiltroAPagar({ filtro: 'tudo', categoria: ['a', 'b'] }).filtro).toBe('a_pagar')
  })

  it('writes the instalment as "2 de 6", and a month of a series as "mensal"', () => {
    expect(textoParcela({ parcela: 2, total: 6, recorrente: false })).toBe('Parcela 2 de 6')
    expect(textoParcela({ parcela: 3, total: null, recorrente: true })).toBe('Mensal')
    expect(textoParcela({ parcela: null, total: null, recorrente: false })).toBeNull()
  })
})
