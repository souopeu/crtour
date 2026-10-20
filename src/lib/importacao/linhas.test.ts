import { describe, expect, test } from 'vitest'
import { converterLinha, normalizarData } from './linhas'

describe('normalizarData', () => {
  test.each([
    [new Date(Date.UTC(1990, 4, 17)), '1990-05-17'],
    ['17/05/1990', '1990-05-17'],
    ['1990-05-17', '1990-05-17'],
    [45000, '2023-03-15'], // Excel serial (known value)
    ['', ''],
    [null, ''],
  ])('%j -> %j', (entrada, esperado) => {
    expect(normalizarData(entrada)).toBe(esperado)
  })
  test.each(['31/02/2020', '17-05-1990', 'amanhã', -5])('%j is invalid', (entrada) => {
    expect(normalizarData(entrada)).toBeNull()
  })
})

describe('converterLinha', () => {
  test('converts a full row to the import payload', () => {
    const r = converterLinha(3, {
      nome: ' Ana Souza ', whatsapp: '(11) 99999-0001', email: 'ANA@x.com', pais: 'brasil', estado: 'sp', cidade: 'Santos',
      aniversario: '17/05/1990', origem: 'Indicação', destinos: 'Lisboa; Paris', faixaOrcamento: 'R$ 5 mil',
      qtdPessoas: 4, restricoes: 'Vegetariana', passaporteValidade: new Date(Date.UTC(2030, 0, 31)),
      etiquetas: 'Europa, VIP, europa', consentimento: 'Aceitou',
    })
    expect(r).toEqual({
      ok: true,
      linha: {
        linha: 3, nome: 'Ana Souza', whatsapp: '5511999990001', email: 'ana@x.com', pais: 'Brasil', estado: 'SP', cidade: 'Santos',
        aniversario: '1990-05-17', origem: 'indicacao', destinos_interesse: ['Lisboa', 'Paris'],
        faixa_orcamento: 'R$ 5 mil', qtd_pessoas: 4, restricoes: 'Vegetariana', passaporte_validade: '2030-01-31',
        consentimento_whatsapp: 'aceitou', etiquetas: ['Europa', 'VIP'],
      },
    })
  })

  test('only the name is required; the rest becomes null/empty', () => {
    const r = converterLinha(2, { nome: 'Beto' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.linha.whatsapp).toBeNull()
      expect(r.linha.consentimento_whatsapp).toBe('nao_informado')
      expect(r.linha.etiquetas).toEqual([])
    }
  })

  test('reports every problem of the row in Portuguese', () => {
    const r = converterLinha(7, { nome: '', whatsapp: '123', email: 'x', origem: 'TV', aniversario: '31/02/2020', consentimento: 'talvez' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.linha).toBe(7)
      const campos = r.erros.map((e) => e.campo).sort()
      expect(campos).toEqual(['aniversario', 'consentimento', 'email', 'nome', 'origem', 'whatsapp'])
      expect(r.erros.find((e) => e.campo === 'origem')?.mensagem).toMatch(/Instagram/)
    }
  })

  test('rejects too many or too long tags', () => {
    const muitas = Array.from({ length: 21 }, (_, i) => `T${i}`).join(',')
    expect(converterLinha(2, { nome: 'A', etiquetas: muitas }).ok).toBe(false)
    expect(converterLinha(2, { nome: 'A', etiquetas: 'x'.repeat(41) }).ok).toBe(false)
  })
})
