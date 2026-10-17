import { describe, expect, test } from 'vitest'
import { TIPOS_FORNECEDOR, custoSchema, fornecedorSchema, margem, rotuloDoTipo } from './custos'

const HOJE = '2026-10-17'
const UUID = '6f1c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f'

describe('fornecedorSchema', () => {
  test('name, type and optional contact', () => {
    expect(fornecedorSchema.parse({ nome: ' Van do Zé ', tipo: 'transporte', contato: ' (11) 98888-0000 ' })).toEqual({ nome: 'Van do Zé', tipo: 'transporte', contato: '(11) 98888-0000' })
    expect(fornecedorSchema.parse({ nome: 'Hotel', tipo: 'hospedagem', contato: '' })).toEqual({ nome: 'Hotel', tipo: 'hospedagem', contato: null })
    const r = fornecedorSchema.safeParse({ nome: '', tipo: 'nave', contato: '' })
    expect(!r.success && r.error.flatten().fieldErrors).toEqual({ nome: ['Digite o nome do fornecedor.'], tipo: ['Escolha um tipo da lista.'] })
  })
  test('labels', () => {
    expect(TIPOS_FORNECEDOR.map((t) => t.valor)).toEqual(['transporte', 'hospedagem', 'guia', 'ingresso', 'alimentacao', 'outro'])
    expect(rotuloDoTipo('alimentacao')).toBe('Alimentação')
  })
})

describe('custoSchema', () => {
  const s = custoSchema(HOJE)
  test('a cost still to pay, with supplier and due date', () => {
    expect(s.parse({ descricao: ' Transfer ', valor: '1.500,00', vencimento: '2027-03-01', fornecedor: UUID, pago: '', dataPagamento: '' }))
      .toEqual({ descricao: 'Transfer', valor_centavos: 150000, vencimento: '2027-03-01', fornecedor_id: UUID, pago_em: null })
  })
  test('already paid needs the date (not in the future)', () => {
    expect(s.parse({ descricao: 'Guia', valor: '300', vencimento: '', fornecedor: '', pago: 'on', dataPagamento: '2026-10-10' }))
      .toEqual({ descricao: 'Guia', valor_centavos: 30000, vencimento: null, fornecedor_id: null, pago_em: '2026-10-10' })
    const sem = s.safeParse({ descricao: 'Guia', valor: '300', vencimento: '', fornecedor: '', pago: 'on', dataPagamento: '' })
    expect(!sem.success && (sem.error.flatten().fieldErrors as Record<string, string[]>).dataPagamento).toEqual(['Informe a data do pagamento.'])
    const futuro = s.safeParse({ descricao: 'Guia', valor: '300', vencimento: '', fornecedor: '', pago: 'on', dataPagamento: '2026-12-01' })
    expect(!futuro.success && (futuro.error.flatten().fieldErrors as Record<string, string[]>).dataPagamento).toEqual(['A data do pagamento não pode ser no futuro.'])
  })
  test('messages', () => {
    const r = s.safeParse({ descricao: '', valor: '0', vencimento: '31/02', fornecedor: 'x', pago: '', dataPagamento: '' })
    expect(!r.success && r.error.flatten().fieldErrors).toEqual({
      descricao: ['Descreva o custo (ex.: ônibus, guia, hotel).'],
      valor: ['Digite um valor maior que zero, ex.: 1.500,00.'],
      vencimento: ['Escolha uma data válida ou deixe em branco.'],
      fornecedor: ['Escolha o fornecedor na lista.'],
    })
  })
})

describe('margem', () => {
  test('sold − costs, with paid and still to pay', () => {
    expect(margem(500000, [{ valor_centavos: 150000, pago_em: '2026-10-10' }, { valor_centavos: 50000, pago_em: null }]))
      .toEqual({ receita: 500000, custos: 200000, pagos: 150000, aPagar: 50000, margem: 300000, percentual: 0.6 })
  })
  test('no revenue: no percentage; negative margin is shown as is', () => {
    expect(margem(0, [{ valor_centavos: 1000, pago_em: null }])).toEqual({ receita: 0, custos: 1000, pagos: 0, aPagar: 1000, margem: -1000, percentual: null })
  })
})
