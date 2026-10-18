import { describe, expect, test } from 'vitest'
import { lerFormProposta, mensagemProposta, montarDados, resumoValores, situacaoProposta } from './proposta'

const fd = (campos: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}
const HOJE = '2026-10-18'

describe('lerFormProposta', () => {
  test('reads people, money, dates and notes', () => {
    const r = lerFormProposta(fd({ pessoas: '2', total: '9.000,00', sinal: '2.000,00', sinalAte: '2026-10-25', saldoAte: '2027-02-10', validade: '2026-10-25', observacoes: ' Hotel 4 estrelas ' }), HOJE)
    expect(r).toEqual({ ok: true, dados: { pessoas: 2, totalCentavos: 900000, sinalCentavos: 200000, sinalAte: '2026-10-25', saldoAte: '2027-02-10', validade: '2026-10-25', observacoes: 'Hotel 4 estrelas' } })
  })
  test('no deposit is zero and optional dates are empty', () => {
    const r = lerFormProposta(fd({ pessoas: '1', total: '500,00', validade: HOJE }), HOJE)
    expect(r.ok && r.dados).toMatchObject({ sinalCentavos: 0, sinalAte: null, saldoAte: null, observacoes: null })
  })
  test('explains each problem', () => {
    const r = lerFormProposta(fd({ pessoas: '0', total: 'abc', sinal: '10,00', validade: '2026-10-17' }), HOJE)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.campos.pessoas).toBeDefined()
      expect(r.campos.total).toBe('Digite o valor total, como 9.000,00.')
      expect(r.campos.validade).toBe('A validade não pode ser antes de hoje.')
    }
  })
  test('the deposit cannot be above the total', () => {
    const r = lerFormProposta(fd({ pessoas: '1', total: '100,00', sinal: '200,00', validade: HOJE }), HOJE)
    expect(!r.ok && r.campos.sinal).toBe('O sinal não pode ser maior que o total.')
  })
})

describe('montarDados and resumoValores', () => {
  const dados = montarDados(
    { pessoas: 3, totalCentavos: 1000000, sinalCentavos: 300000, sinalAte: null, saldoAte: '2027-02-10', validade: '2026-10-25', observacoes: null },
    { agencia: 'Viagens Alfa', cliente: 'Ana Souza', titulo: 'Lisboa da Ana', passeio: 'Lisboa clássica', destino: 'Lisboa', saida: '2027-03-10', inclui: 'Aéreo', naoInclui: null },
  )
  test('R69: the snapshot carries everything the page shows', () => {
    expect(dados).toMatchObject({ agencia: 'Viagens Alfa', cliente: 'Ana Souza', passeio: 'Lisboa clássica', saida: '2027-03-10', pessoas: 3, totalCentavos: 1000000, inclui: 'Aéreo', naoInclui: null })
  })
  test('per person (rounded to the cent) and balance', () => {
    expect(resumoValores(dados)).toEqual({ porPessoaCentavos: 333333, saldoCentavos: 700000 })
  })
})

describe('situacaoProposta', () => {
  test('valid until the end of the validity day, then expired; revoked wins', () => {
    expect(situacaoProposta({ validade: HOJE, revogada_em: null }, HOJE)).toBe('valida')
    expect(situacaoProposta({ validade: '2026-10-17', revogada_em: null }, HOJE)).toBe('vencida')
    expect(situacaoProposta({ validade: '2026-12-01', revogada_em: '2026-10-18T10:00:00Z' }, HOJE)).toBe('revogada')
  })
})

describe('mensagemProposta', () => {
  test('first name, the link and the validity', () => {
    expect(mensagemProposta('Ana Souza', 'https://x.dev/p/ABC', '2026-10-25')).toBe('Olá, Ana! Segue a proposta da sua viagem: https://x.dev/p/ABC (válida até 25/10/2026).')
  })
})
