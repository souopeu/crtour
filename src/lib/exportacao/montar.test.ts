import { describe, expect, test } from 'vitest'
import { montarCsvAnotacoes, montarCsvClientes, paginar, type ClienteExportado } from './montar'

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
