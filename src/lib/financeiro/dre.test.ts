import { describe, expect, it } from 'vitest'
import type { LinhaAPagar } from '@/lib/contas/contas'
import type { Movimento } from './conferencia'
import { aPagarCsv, dreCsv, itensCaixa, lerPeriodoDre, mesesDoPeriodo, montarDre, type ItemDre } from './dre'

const item = (grupo: ItemDre['grupo'], valor: number, categoria?: string): ItemDre => ({ grupo, categoria, descricao: `${grupo} ${valor}`, data: '2026-10-05', valor })

describe('montarDre', () => {
  const linhas = montarDre([
    item('receita', 50000), item('receita', -2000), item('custo', 15000), item('comissao', 1500),
    item('despesa', 3000, 'Aluguel'), item('despesa', 500, 'Marketing'), item('despesa', 700, 'Aluguel'),
  ])
  const valor = (chave: string) => linhas.find((l) => l.chave === chave)?.valor

  it('builds revenue, margin and result in order, with expenses per category (largest first)', () => {
    expect(linhas.map((l) => l.rotulo)).toEqual([
      'Receita bruta', '(−) Custos das saídas', '= Margem', '(−) Comissões', '(−) Aluguel', '(−) Marketing', '= Resultado',
    ])
    expect(valor('receita')).toBe(48000)
    expect(valor('margem')).toBe(33000)
    expect(valor('despesa:Aluguel')).toBe(3700)
    expect(valor('resultado')).toBe(33000 - 1500 - 3700 - 500)
  })
  it('keeps what makes up each line, and totals carry no items', () => {
    expect(linhas.find((l) => l.chave === 'receita')?.itens).toHaveLength(2)
    expect(linhas.find((l) => l.chave === 'margem')).toMatchObject({ total: true, itens: [] })
  })
  it('shows the fixed lines even when empty', () => {
    expect(montarDre([]).map((l) => [l.chave, l.valor])).toEqual([['receita', 0], ['custo', 0], ['margem', 0], ['comissao', 0], ['resultado', 0]])
  })
})

describe('lerPeriodoDre', () => {
  const hoje = '2026-10-26'
  it('defaults to this month, cash basis', () => {
    expect(lerPeriodoDre({}, hoje)).toEqual({ de: '2026-10', ate: '2026-10', base: 'caixa' })
  })
  it('reads the range and basis, swapping a reversed range', () => {
    expect(lerPeriodoDre({ de: '2026-09', ate: '2026-07', base: 'competencia' }, hoje)).toEqual({ de: '2026-07', ate: '2026-09', base: 'competencia' })
  })
  it('limits the range to 12 months ending at "ate", and ignores junk', () => {
    expect(lerPeriodoDre({ de: '2025-01', ate: '2026-10' }, hoje).de).toBe('2025-11')
    expect(lerPeriodoDre({ de: 'x', ate: '2026-13', base: 'outra' }, hoje)).toEqual({ de: '2026-10', ate: '2026-10', base: 'caixa' })
  })
})

describe('mesesDoPeriodo', () => {
  it('lists every month, across a year turn', () => {
    expect(mesesDoPeriodo('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })
})

describe('CSV', () => {
  it('exports the DRE lines, then what makes them up', () => {
    const csv = dreCsv(montarDre([item('receita', 12345)]), { de: '2026-10', ate: '2026-10', base: 'caixa' })
    expect(csv.startsWith('﻿DRE;Caixa;outubro de 2026')).toBe(true)
    expect(csv).toContain('Receita bruta;123,45\r\n')
    expect(csv).toContain('\r\nMargem;123,45\r\n') // no leading "=", which spreadsheets would escape
    expect(csv).toContain('Receita bruta;05/10/2026;receita 12345;123,45\r\n')
  })
  it('exports the bills to pay with status', () => {
    const l: LinhaAPagar = { origem: 'conta', id: 'c', descricao: 'Luz', categoria: 'Outros', valor: 3000, vencimento: '2026-10-20', pagoEm: null, fornecedor: null, parcela: '1/3', href: '/x' }
    const csv = aPagarCsv([l], '2026-10-26')
    expect(csv).toContain('Descrição;Categoria;Fornecedor;Parcela;Vencimento;Valor (R$);Situação;Pago em\r\n')
    expect(csv).toContain('Luz;Outros;;1/3;20/10/2026;30,00;Vencida;\r\n')
  })
})

describe('itensCaixa', () => {
  const m = (origem: Movimento['origem'], valor: number, categoria?: string): Movimento =>
    ({ id: origem, data: '2026-10-05', sentido: origem === 'pagamento' ? 'entrada' : 'saida', origem, descricao: origem, valor, forma: 'pix', categoria })
  it('turns the money that moved into DRE entries; refunds lower the revenue', () => {
    const itens = itensCaixa([m('pagamento', 1000), m('estorno', 300), m('custo', 200), m('comissao', 50), m('conta', 70, 'Aluguel')])
    expect(itens.map((i) => [i.grupo, i.valor, i.categoria])).toEqual([
      ['receita', 1000, undefined], ['receita', -300, undefined], ['custo', 200, undefined], ['comissao', 50, undefined], ['despesa', 70, 'Aluguel'],
    ])
    expect(montarDre(itens).at(-1)?.valor).toBe(1000 - 300 - 200 - 50 - 70)
  })
})
