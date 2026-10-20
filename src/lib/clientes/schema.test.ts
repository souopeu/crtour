import { describe, expect, test } from 'vitest'
import { clienteSchema } from './schema'

const vazio = {
  nome: '', whatsapp: '', email: '', pais: '', estado: '', cidade: '', aniversario: '', origem: '', destinos: '',
  faixaOrcamento: '', qtdPessoas: '', restricoes: '', passaporteValidade: '', consentimento: 'nao_informado',
}

describe('clienteSchema', () => {
  test('accepts only a name; optional fields become null', () => {
    const r = clienteSchema.parse({ ...vazio, nome: '  Ana Souza ' })
    expect(r).toEqual({
      nome: 'Ana Souza', whatsapp: null, email: null, pais: 'Brasil', estado: null, cidade: null, aniversario: null, origem: null,
      destinos_interesse: [], faixa_orcamento: null, qtd_pessoas: null, restricoes: null,
      passaporte_validade: null, consentimento_whatsapp: 'nao_informado',
    })
  })

  test('maps and normalizes a full record', () => {
    const r = clienteSchema.parse({
      ...vazio, nome: 'Ana', whatsapp: '(11) 99999-9999', email: ' ANA@Mail.com ', cidade: 'Santos',
      aniversario: '1990-05-17', origem: 'instagram', destinos: 'Lisboa, Fernando de Noronha\nlisboa; Paris',
      faixaOrcamento: 'R$ 5 a 8 mil', qtdPessoas: '4', restricoes: 'Vegetariana', passaporteValidade: '2030-01-31',
      consentimento: 'aceitou',
    })
    expect(r.whatsapp).toBe('5511999999999')
    expect(r.email).toBe('ana@mail.com')
    expect(r.destinos_interesse).toEqual(['Lisboa', 'Fernando de Noronha', 'Paris'])
    expect(r.qtd_pessoas).toBe(4)
    expect(r.origem).toBe('instagram')
    expect(r.consentimento_whatsapp).toBe('aceitou')
  })

  test('R126: Brazil takes a UF in any case; abroad the state is free text', () => {
    expect(clienteSchema.parse({ ...vazio, nome: 'A', pais: 'brasil', estado: 'sp' })).toMatchObject({ pais: 'Brasil', estado: 'SP' })
    expect(clienteSchema.parse({ ...vazio, nome: 'A', pais: ' Portugal ', estado: 'Lisboa' })).toMatchObject({ pais: 'Portugal', estado: 'Lisboa' })
    expect(clienteSchema.safeParse({ ...vazio, nome: 'A', estado: 'São Paulo' }).success).toBe(false)
  })

  test.each([
    ['blank name', { nome: '   ' }],
    ['long name', { nome: 'a'.repeat(201) }],
    ['bad whatsapp', { nome: 'A', whatsapp: '123' }],
    ['bad email', { nome: 'A', email: 'x' }],
    ['unknown origin', { nome: 'A', origem: 'tv' }],
    ['invalid date', { nome: 'A', aniversario: '2020-02-31' }],
    ['malformed date', { nome: 'A', aniversario: '17/05/1990' }],
    ['future birthday', { nome: 'A', aniversario: '2999-01-01' }],
    ['zero people', { nome: 'A', qtdPessoas: '0' }],
    ['non-integer people', { nome: 'A', qtdPessoas: '2.5' }],
    ['unknown consent', { nome: 'A', consentimento: 'talvez' }],
    ['too many destinations', { nome: 'A', destinos: Array.from({ length: 31 }, (_, i) => `D${i}`).join(',') }],
  ])('rejects %s', (_nome, parcial) => {
    expect(clienteSchema.safeParse({ ...vazio, ...parcial }).success).toBe(false)
  })
})
