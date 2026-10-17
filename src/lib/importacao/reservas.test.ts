import { describe, expect, test } from 'vitest'
import { converterLinhaReserva, mapearColunasReserva, mensagemDoProblema, resumirConferencia } from './reservas'

const HOJE = '2026-10-17'

describe('mapearColunasReserva', () => {
  test('recognizes the template and common names', () => {
    const r = mapearColunasReserva(['WhatsApp do cliente', 'E-mail do cliente', 'Passeio*', 'Data da saída*', 'Pessoas*', 'Valor total', 'Valor pago', 'Forma de pagamento', 'Data do pagamento', 'Obs'])
    expect(r.ok && r.colunas).toEqual(['whatsapp', 'email', 'passeio', 'data', 'pessoas', 'total', 'pago', 'forma', 'dataPagamento', null])
    expect(r.ok && r.ignoradas).toEqual(['Obs'])
  })
  test('needs a client column, the tour and the departure date', () => {
    expect(mapearColunasReserva(['Passeio', 'Data da saída', 'Pessoas'])).toEqual({ ok: false, erro: 'Falta a coluna do cliente: "WhatsApp do cliente" ou "E-mail do cliente".' })
    expect(mapearColunasReserva(['WhatsApp', 'Data da saída', 'Pessoas'])).toEqual({ ok: false, erro: 'Falta a coluna "Passeio".' })
    expect(mapearColunasReserva(['WhatsApp', 'Passeio', 'Pessoas'])).toEqual({ ok: false, erro: 'Falta a coluna "Data da saída".' })
    expect(mapearColunasReserva(['WhatsApp', 'Passeio', 'Data da saída'])).toEqual({ ok: false, erro: 'Falta a coluna "Pessoas".' })
  })
})

describe('converterLinhaReserva', () => {
  test('a full row', () => {
    const r = converterLinhaReserva(2, {
      whatsapp: '(11) 99999-0001', passeio: ' Lisboa clássica ', data: '10/03/2027', pessoas: 2, total: '2.000,00', pago: 500, forma: 'Pix', dataPagamento: '01/10/2026',
    }, HOJE)
    expect(r).toEqual({ ok: true, linha: {
      linha: 2, whatsapp: '5511999990001', email: null, passeio: 'Lisboa clássica', data: '2027-03-10', pessoas: 2, total: 200000, pago: 50000, forma: 'pix', data_pagamento: '2026-10-01',
    } })
  })
  test('e-mail only, no total, nothing paid; Excel numbers and dates', () => {
    const r = converterLinhaReserva(3, { email: ' Bia@X.com ', passeio: 'Lisboa', data: new Date('2027-03-10T00:00:00Z'), pessoas: '1', pago: '' }, HOJE)
    expect(r).toEqual({ ok: true, linha: { linha: 3, whatsapp: null, email: 'bia@x.com', passeio: 'Lisboa', data: '2027-03-10', pessoas: 1, total: null, pago: 0, forma: null, data_pagamento: null } })
    expect(converterLinhaReserva(4, { whatsapp: '11999990001', passeio: 'L', data: 46456, pessoas: 1, total: 1234.5 }, HOJE)).toMatchObject({ ok: true, linha: { data: '2027-03-10', total: 123450 } })
  })
  test('each problem is explained, all at once', () => {
    const r = converterLinhaReserva(5, { whatsapp: '123', email: 'nope', passeio: '', data: '31/02/2027', pessoas: 0, total: 'abc', pago: '10,00', forma: 'cheque', dataPagamento: '01/01/2030' }, HOJE)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erros).toEqual([
      'WhatsApp inválido: use DDD + número, ex.: (11) 99999-0001.',
      'E-mail inválido.',
      'Informe o passeio, com o nome igual ao cadastrado.',
      'Data da saída: use uma data válida (dd/mm/aaaa).',
      'Pessoas: use um número inteiro de 1 a 500.',
      'Valor total inválido: use, por exemplo, 2.000,00.',
      'Forma de pagamento: use Pix, Dinheiro, Cartão, Transferência ou Outro.',
      'Data do pagamento não pode ser no futuro.',
    ])
  })
  test('a client is required, and a payment needs its form and date', () => {
    const r = converterLinhaReserva(6, { passeio: 'Lisboa', data: '10/03/2027', pessoas: 1, pago: '100,00' }, HOJE)
    expect(!r.ok && r.erros).toEqual([
      'Informe o WhatsApp ou o e-mail do cliente (o cliente precisa estar cadastrado).',
      'Valor pago informado: preencha a forma de pagamento.',
      'Valor pago informado: preencha a data do pagamento.',
    ])
  })
})

describe('resumirConferencia', () => {
  const linha = (n: number, pessoas: number) => ({ linha: n, whatsapp: 'x', email: null, passeio: 'p', data: 'd', pessoas, total: null, pago: 0, forma: null, data_pagamento: null })
  test('rows that will not fit are flagged in order; problems keep their reason', () => {
    const r = resumirConferencia(
      [linha(2, 2), linha(3, 1), linha(4, 1), linha(5, 1)],
      [
        { linha: 2, saida_id: 's1', vagas_livres: 3, problema: null },
        { linha: 3, saida_id: 's1', vagas_livres: 3, problema: null },
        { linha: 4, saida_id: 's1', vagas_livres: 3, problema: null },
        { linha: 5, saida_id: null, vagas_livres: null, problema: 'passeio_nao_encontrado' },
      ],
    )
    expect(r).toEqual({
      prontas: 2,
      semVagas: [4],
      problemas: [{ linha: 5, mensagem: mensagemDoProblema('passeio_nao_encontrado') }],
    })
  })
})

describe('mensagemDoProblema', () => {
  test('known codes in plain Portuguese; unknown codes still say something useful', () => {
    expect(mensagemDoProblema('cliente_nao_encontrado')).toBe('Cliente não encontrado: importe ou cadastre o cliente antes (mesmo WhatsApp ou e-mail).')
    expect(mensagemDoProblema('CR001')).toBe('Sem vagas suficientes nessa saída.')
    expect(mensagemDoProblema('xyz')).toBe('Não foi possível importar esta linha (código xyz).')
  })
})
