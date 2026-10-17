import { describe, expect, test } from 'vitest'
import {
  montarCsvAcompanhantes, montarCsvAnotacoes, montarCsvClientes, montarCsvPagamentos, montarCsvReservas, paginar,
  type ClienteExportado,
} from './montar'

const cliente = (extra: Partial<ClienteExportado> = {}): ClienteExportado => ({
  id: 'c1', nome: 'Ana Souza', whatsapp: '5511999990001', email: 'ana@x.com', cidade: 'Santos',
  aniversario: '1990-05-17', origem: 'indicacao', destinos_interesse: ['Lisboa', 'Paris'], faixa_orcamento: 'R$ 5 mil',
  qtd_pessoas: 2, restricoes: 'Vegetariana', passaporte_validade: '2030-01-31', consentimento_whatsapp: 'aceitou',
  consentimento_em: '2026-10-17T15:30:00Z', criado_em: '2026-10-16T12:00:00Z', ...extra,
})

describe('paginar', () => {
  test('keeps fetching full pages until a short one arrives', async () => {
    const chamadas: [number, number][] = []
    const total = 2500
    const r = await paginar(async (de, ate) => {
      chamadas.push([de, ate])
      return { data: Array.from({ length: Math.max(0, Math.min(ate + 1, total) - de) }, (_, i) => de + i), error: null }
    })
    expect(r).toHaveLength(2500)
    expect(chamadas).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  test('stops after an exact multiple of the page size', async () => {
    const r = await paginar(async (de) => ({ data: de === 0 ? Array.from({ length: 1000 }, (_, i) => i) : [], error: null }))
    expect(r).toHaveLength(1000)
  })

  test('fails loudly instead of returning partial data', async () => {
    await expect(paginar(async () => ({ data: null, error: { code: '57014' } }))).rejects.toThrow(/57014/)
  })
})

describe('montarCsvClientes', () => {
  test('writes importable headers, labels and dd/mm/aaaa dates', () => {
    const csv = montarCsvClientes([cliente()], [{ cliente_id: 'c1', etiqueta_id: 'e1' }, { cliente_id: 'c1', etiqueta_id: 'e2' }],
      [{ id: 'e1', nome: 'Europa' }, { id: 'e2', nome: 'VIP' }])
    const [cabecalho, linha] = csv.replace('﻿', '').split('\r\n')
    expect(cabecalho).toBe('Nome*;WhatsApp;E-mail;Cidade;Aniversário;Origem;Destinos de interesse;Faixa de orçamento;Número de pessoas;Restrições;Validade do passaporte;Etiquetas;Consentimento WhatsApp;Consentimento em;Cadastrado em')
    expect(linha).toBe('Ana Souza;5511999990001;ana@x.com;Santos;17/05/1990;Indicação;Lisboa, Paris;R$ 5 mil;2;Vegetariana;31/01/2030;Europa, VIP;Aceitou;17/10/2026 12:30;16/10/2026 09:00')
  })

  test('handles empty optional fields and unknown tag ids', () => {
    const csv = montarCsvClientes(
      [cliente({ whatsapp: null, origem: null, aniversario: null, consentimento_em: null, destinos_interesse: [], consentimento_whatsapp: 'nao_informado' })],
      [{ cliente_id: 'c1', etiqueta_id: 'sumiu' }], [])
    const linha = csv.replace('﻿', '').split('\r\n')[1]
    expect(linha.startsWith('Ana Souza;;ana@x.com;Santos;;;;')).toBe(true)
    expect(linha).toContain('Não informado')
  })

  test('neutralizes formulas typed as names', () => {
    expect(montarCsvClientes([cliente({ nome: '=1+1' })], [], [])).toContain("\r\n'=1+1;")
  })
})

describe('montarCsvAnotacoes', () => {
  test('maps notes to client names and formats the time in Brazil', () => {
    const csv = montarCsvAnotacoes(
      [{ id: 'c1', nome: 'Ana Souza' }],
      [{ id: 'n1', cliente_id: 'c1', autor_nome: 'Pessoa', texto: 'Quer viajar', criada_em: '2026-10-17T15:30:00Z' },
       { id: 'n2', cliente_id: 'apagado', autor_nome: 'Pessoa', texto: 'órfã', criada_em: '2026-10-17T15:31:00Z' }],
    )
    expect(csv).toBe('﻿Cliente;Autor;Data;Anotação\r\nAna Souza;Pessoa;17/10/2026 12:30;Quer viajar\r\n;Pessoa;17/10/2026 12:31;órfã\r\n')
  })
})

const nomes = {
  clientes: new Map([['c1', 'Ana Souza'], ['c2', '=cmd']]),
  saidas: new Map([['s1', { data: '2027-03-10', passeio: 'Lisboa clássica' }]]),
}

describe('montarCsvReservas', () => {
  test('one row per reservation with money as 1234,50 and Brazilian dates', () => {
    const csv = montarCsvReservas(
      [{ id: 'r1', cliente_id: 'c1', saida_id: 's1', qtd_pessoas: 2, valor_total_centavos: 200000, pago_centavos: 50000, saldo_centavos: 150000,
         vencimento_saldo: '2027-02-01', situacao: 'ativa', observacao: 'quarto duplo', criada_em: '2026-10-17T15:30:00Z' }],
      nomes,
    )
    expect(csv).toBe('\uFEFFCliente;Passeio;Data da saída;Pessoas;Valor total;Pago;Falta pagar;Vencimento do saldo;Situação;Observação;Criada em\r\n'
      + 'Ana Souza;Lisboa clássica;10/03/2027;2;2000,00;500,00;1500,00;01/02/2027;Ativa;quarto duplo;17/10/2026 12:30\r\n')
  })
  test('cancelled reservations, missing due date and formula-like names are handled', () => {
    const csv = montarCsvReservas(
      [{ id: 'r2', cliente_id: 'c2', saida_id: 's1', qtd_pessoas: 1, valor_total_centavos: 100000, pago_centavos: 0, saldo_centavos: 100000,
         vencimento_saldo: null, situacao: 'cancelada', observacao: null, criada_em: '2026-10-17T15:30:00Z' }],
      nomes,
    )
    expect(csv).toContain("\r\n'=cmd;Lisboa clássica;10/03/2027;1;1000,00;0,00;1000,00;;Cancelada;;")
  })
})

describe('montarCsvPagamentos', () => {
  test('lists every record, refunds included, with the reservation context', () => {
    const csv = montarCsvPagamentos(
      [
        { id: 'p1', reserva_id: 'r1', tipo: 'sinal', forma: 'pix', valor_centavos: 50000, data: '2026-10-17', observacao: null, estorno_de: null },
        { id: 'p2', reserva_id: 'r1', tipo: 'estorno', forma: 'pix', valor_centavos: 50000, data: '2026-10-18', observacao: 'desistiu', estorno_de: 'p1' },
      ],
      new Map([['r1', { cliente_id: 'c1', saida_id: 's1' }]]),
      nomes,
    )
    expect(csv).toBe('\uFEFFCliente;Passeio;Data da saída;Data do pagamento;Tipo;Forma;Valor;Observação\r\n'
      + 'Ana Souza;Lisboa clássica;10/03/2027;17/10/2026;Sinal;Pix;500,00;\r\n'
      + 'Ana Souza;Lisboa clássica;10/03/2027;18/10/2026;Estorno;Pix;500,00;desistiu\r\n')
  })
})

describe('montarCsvAcompanhantes', () => {
  test('lists companions with their reservation and whether they became clients', () => {
    const csv = montarCsvAcompanhantes(
      [{ reserva_id: 'r1', nome: 'Maria Silva', whatsapp: '5511988880000', cliente_id: null },
       { reserva_id: 'r1', nome: 'João Souza', whatsapp: null, cliente_id: 'c9' }],
      new Map([['r1', { cliente_id: 'c1', saida_id: 's1' }]]),
      nomes,
    )
    expect(csv).toBe('\uFEFFResponsável;Passeio;Data da saída;Acompanhante;WhatsApp;Cadastrado como cliente\r\n'
      + 'Ana Souza;Lisboa clássica;10/03/2027;Maria Silva;(11) 98888-0000;Não\r\n'
      + 'Ana Souza;Lisboa clássica;10/03/2027;João Souza;;Sim\r\n')
  })
})
