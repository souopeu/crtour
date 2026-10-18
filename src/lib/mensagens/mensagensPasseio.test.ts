import { describe, expect, test } from 'vitest'
import { MODELOS_PADRAO, TIPOS_MENSAGEM, aplicarModeloPasseio, configMensagensSchema, modeloEfetivo, rotuloDaMensagem } from './mensagensPasseio'

describe('aplicarModeloPasseio', () => {
  test('first name, tour, date and balance', () => {
    expect(aplicarModeloPasseio('Oi {nome}! {passeio} em {data}. Falta {saldo}. {nome}', { nome: 'Ana Maria Souza', passeio: 'Lisboa', data: '2027-03-10', saldoCentavos: 150050 }))
      .toBe('Oi Ana! Lisboa em 10/03/2027. Falta R$ 1.500,50. Ana')
  })
  test('unknown variables stay as typed', () => {
    expect(aplicarModeloPasseio('{hotel}', { nome: 'A', passeio: 'P', data: '2027-01-01', saldoCentavos: 0 })).toBe('{hotel}')
  })
})

describe('modeloEfetivo', () => {
  test('saved text, or the default when empty', () => {
    expect(modeloEfetivo('lembrete', 'Oi {nome}')).toBe('Oi {nome}')
    expect(modeloEfetivo('lembrete', null)).toBe(MODELOS_PADRAO.lembrete)
    expect(modeloEfetivo('avaliacao', '  ')).toBe(MODELOS_PADRAO.avaliacao)
  })
  test('every type has a label and a default using the variables', () => {
    expect(TIPOS_MENSAGEM.map((t) => t.valor)).toEqual(['confirmacao', 'lembrete', 'avaliacao', 'um_ano', 'aniversario'])
    for (const t of TIPOS_MENSAGEM) expect(MODELOS_PADRAO[t.valor]).toContain('{nome}')
  })
  test('R71, R72: birthday and one-year labels and defaults', () => {
    expect(rotuloDaMensagem('um_ano')).toBe('1 ano da viagem')
    expect(rotuloDaMensagem('aniversario')).toBe('Aniversário')
    expect(aplicarModeloPasseio(MODELOS_PADRAO.um_ano, { nome: 'Ana Souza', passeio: 'Lisboa', data: '2025-10-18', saldoCentavos: 0 })).toContain('Lisboa')
    expect(aplicarModeloPasseio(MODELOS_PADRAO.aniversario, { nome: 'Ana Souza', passeio: '', data: '', saldoCentavos: 0 })).toMatch(/^Feliz aniversário, Ana!/)
  })
})

describe('configMensagensSchema', () => {
  const base = { diasLembrete: '2', diasAvaliacao: '1', confirmacao: '', lembrete: ' Oi {nome} ', avaliacao: '', um_ano: '', aniversario: 'Parabéns, {nome}!' }
  test('days and templates; empty template = default (null)', () => {
    expect(configMensagensSchema.parse(base)).toEqual({
      dias_lembrete: 2, dias_avaliacao: 1, modelo_confirmacao: null, modelo_lembrete: 'Oi {nome}', modelo_avaliacao: null, modelo_um_ano: null, modelo_aniversario: 'Parabéns, {nome}!',
    })
  })
  test('limits', () => {
    const r = configMensagensSchema.safeParse({ ...base, diasLembrete: '0', diasAvaliacao: '61', avaliacao: 'x'.repeat(1001) })
    expect(r.success).toBe(false)
    if (!r.success) {
      const campos = r.error.flatten().fieldErrors as Record<string, string[]>
      expect(campos.diasLembrete).toEqual(['Use um número de dias de 1 a 60.'])
      expect(campos.diasAvaliacao).toEqual(['Use um número de dias de 1 a 60.'])
      expect(campos.avaliacao).toEqual(['A mensagem pode ter no máximo 1000 caracteres.'])
    }
  })
})
