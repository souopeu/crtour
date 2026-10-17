import { describe, expect, test } from 'vitest'
import {
  ETAPAS, MOTIVOS, PROBABILIDADE_PADRAO, agruparNegociacoes, ehGanha, negociacaoSchema, rotuloDaEtapa, rotuloDoMotivo, validarMovimento,
} from './negociacoes'

const uuid = 'a4000000-0000-4000-8000-000000000001'

describe('etapas', () => {
  test('the funnel order and labels are the tourism funnel', () => {
    expect(ETAPAS.map((e) => e.valor)).toEqual(['interessado', 'orcamento', 'reservado', 'pago', 'viajou', 'pos_venda', 'perdido'])
    expect(rotuloDaEtapa('pos_venda')).toBe('Pós-venda')
    expect(rotuloDaEtapa('orcamento')).toBe('Orçamento')
  })
  test('default probabilities (to confirm with the client)', () => {
    expect(PROBABILIDADE_PADRAO).toEqual({ interessado: 10, orcamento: 30, reservado: 70, pago: 100, viajou: 100, pos_venda: 100, perdido: 0 })
  })
  test('won stages start at "pago"', () => {
    expect(['interessado', 'orcamento', 'reservado', 'perdido'].some((e) => ehGanha(e as never))).toBe(false)
    expect(['pago', 'viajou', 'pos_venda'].every((e) => ehGanha(e as never))).toBe(true)
  })
  test('loss reasons are fixed and labelled', () => {
    expect(MOTIVOS.map((m) => m.valor)).toEqual(['achou_caro', 'mudou_data', 'fechou_com_outro', 'sem_resposta', 'desistiu', 'outro'])
    expect(rotuloDoMotivo('mudou_data')).toBe('Mudou a data')
    expect(rotuloDoMotivo('desistiu')).toBe('Desistiu da viagem')
  })
})

describe('negociacaoSchema', () => {
  const vazio = { titulo: '', valor: '', etapa: 'interessado', probabilidade: '', responsavel: '', dataEsperada: '', saida: '', motivo: '', motivoTexto: '' }
  test('only the title is required; the rest becomes null/default', () => {
    expect(negociacaoSchema.parse({ ...vazio, titulo: '  Maria: Lisboa em março ' })).toEqual({
      titulo: 'Maria: Lisboa em março', valor_centavos: 0, etapa: 'interessado', probabilidade: null,
      responsavel_id: null, data_fechamento_esperada: null, saida_id: null, motivo_perda: null, motivo_texto: null,
    })
  })
  test('converts value, probability and ids', () => {
    expect(negociacaoSchema.parse({ titulo: 'X', valor: '12.500,00', etapa: 'reservado', probabilidade: '75', responsavel: uuid, dataEsperada: '2027-02-01', saida: uuid, motivo: '', motivoTexto: '' })).toEqual({
      titulo: 'X', valor_centavos: 1250000, etapa: 'reservado', probabilidade: 75, responsavel_id: uuid,
      data_fechamento_esperada: '2027-02-01', saida_id: uuid, motivo_perda: null, motivo_texto: null,
    })
  })
  test('a lost deal needs a reason; "outro" needs a text; a reason is ignored on other stages', () => {
    const base = { ...vazio, titulo: 'X', etapa: 'perdido' }
    expect(negociacaoSchema.safeParse(base).success).toBe(false)
    expect(negociacaoSchema.safeParse({ ...base, motivo: 'outro' }).success).toBe(false)
    expect(negociacaoSchema.parse({ ...base, motivo: 'outro', motivoTexto: ' mudou de ideia ' })).toMatchObject({ etapa: 'perdido', motivo_perda: 'outro', motivo_texto: 'mudou de ideia' })
    expect(negociacaoSchema.parse({ ...base, motivo: 'achou_caro', motivoTexto: 'ignorado' })).toMatchObject({ motivo_perda: 'achou_caro', motivo_texto: null })
    expect(negociacaoSchema.parse({ ...vazio, titulo: 'X', etapa: 'orcamento', motivo: 'achou_caro' })).toMatchObject({ motivo_perda: null, motivo_texto: null })
  })
  test.each([
    ['blank title', { titulo: '  ' }],
    ['long title', { titulo: 'a'.repeat(201) }],
    ['bad value', { titulo: 'X', valor: 'caro' }],
    ['unknown stage', { titulo: 'X', etapa: 'sonhando' }],
    ['unknown loss reason', { titulo: 'X', etapa: 'perdido', motivo: 'tedio' }],
    ['long reason text', { titulo: 'X', etapa: 'perdido', motivo: 'outro', motivoTexto: 'a'.repeat(201) }],
    ['probability over 100', { titulo: 'X', probabilidade: '101' }],
    ['decimal probability', { titulo: 'X', probabilidade: '7.5' }],
    ['bad responsible id', { titulo: 'X', responsavel: 'maria' }],
    ['bad date', { titulo: 'X', dataEsperada: '2027-02-31' }],
    ['bad departure id', { titulo: 'X', saida: '123' }],
  ])('rejects %s', (_n, parcial) => {
    expect(negociacaoSchema.safeParse({ ...vazio, ...parcial }).success).toBe(false)
  })
})

describe('agruparNegociacoes', () => {
  const itens = [
    { id: '1', etapa: 'orcamento' as const, valor: 100000, previsto: 30000, responsavelId: 'u1', responsavelNome: 'Zeca' },
    { id: '2', etapa: 'interessado' as const, valor: 50000, previsto: 5000, responsavelId: null, responsavelNome: null },
    { id: '3', etapa: 'orcamento' as const, valor: 200000, previsto: 60000, responsavelId: 'u2', responsavelNome: 'Ana' },
    { id: '4', etapa: 'pago' as const, valor: 0, previsto: 0, responsavelId: 'u1', responsavelNome: 'Zeca' },
  ]
  test('groups by stage in funnel order, with count and sums (never a probability sum)', () => {
    const g = agruparNegociacoes(itens, 'etapa')
    expect(g.map((x) => [x.chave, x.quantidade, x.totalValor, x.totalPrevisto])).toEqual([
      ['interessado', 1, 50000, 5000],
      ['orcamento', 2, 300000, 90000],
      ['pago', 1, 0, 0],
    ])
    expect(JSON.stringify(g)).not.toContain('probabilidade')
  })
  test('groups by person in charge, alphabetical, with "Sem responsável" last', () => {
    const g = agruparNegociacoes(itens, 'responsavel')
    expect(g.map((x) => [x.rotulo, x.quantidade, x.totalValor])).toEqual([
      ['Ana', 1, 200000], ['Zeca', 2, 100000], ['Sem responsável', 1, 50000],
    ])
  })
  test('no deals, no groups', () => {
    expect(agruparNegociacoes([], 'etapa')).toEqual([])
  })
})

describe('validarMovimento (kanban and "Mover para…")', () => {
  test('any open or won stage moves without a reason', () => {
    expect(validarMovimento('reservado', '', '')).toEqual({ ok: true, etapa: 'reservado', motivo_perda: null, motivo_texto: null })
  })
  test('the lost stage always asks for a reason', () => {
    expect(validarMovimento('perdido', '', '')).toEqual({ ok: false, erro: 'Escolha o motivo da perda.' })
    expect(validarMovimento('perdido', 'outro', ' ')).toEqual({ ok: false, erro: 'Descreva o motivo da perda.' })
    expect(validarMovimento('perdido', 'achou_caro', '')).toEqual({ ok: true, etapa: 'perdido', motivo_perda: 'achou_caro', motivo_texto: null })
    expect(validarMovimento('perdido', 'outro', 'sem verba')).toEqual({ ok: true, etapa: 'perdido', motivo_perda: 'outro', motivo_texto: 'sem verba' })
  })
  test('unknown stages and reasons are refused', () => {
    expect(validarMovimento('sonhando', '', '').ok).toBe(false)
    expect(validarMovimento('perdido', 'tedio', '').ok).toBe(false)
  })
})
