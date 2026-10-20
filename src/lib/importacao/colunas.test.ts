import { describe, expect, test } from 'vitest'
import { campoDaColuna, normalizarCabecalho } from './colunas'

describe('normalizarCabecalho', () => {
  test.each([
    ['Nome*', 'nome'],
    ['  E-mail ', 'e-mail'],
    ['Número de pessoas', 'numero de pessoas'],
    ['Validade do passaporte', 'validade do passaporte'],
  ])('%s -> %s', (entrada, esperado) => {
    expect(normalizarCabecalho(entrada)).toBe(esperado)
  })
})

describe('campoDaColuna', () => {
  test.each([
    ['Nome*', 'nome'], ['Cliente', 'nome'],
    ['WhatsApp', 'whatsapp'], ['Telefone', 'whatsapp'], ['Celular', 'whatsapp'],
    ['E-mail', 'email'], ['Email', 'email'],
    ['Cidade', 'cidade'],
    ['País', 'pais'],
    ['UF', 'estado'],
    ['Aniversário', 'aniversario'], ['Data de nascimento', 'aniversario'],
    ['Origem', 'origem'],
    ['Destinos de interesse', 'destinos'],
    ['Faixa de orçamento', 'faixaOrcamento'],
    ['Número de pessoas', 'qtdPessoas'],
    ['Restrições', 'restricoes'], ['Observações', 'restricoes'],
    ['Validade do passaporte', 'passaporteValidade'],
    ['Etiquetas', 'etiquetas'],
    ['Consentimento WhatsApp', 'consentimento'],
  ])('%s -> %s', (cabecalho, campo) => {
    expect(campoDaColuna(cabecalho)).toBe(campo)
  })

  test('returns null for unknown columns', () => {
    expect(campoDaColuna('Coluna misteriosa')).toBeNull()
    expect(campoDaColuna('')).toBeNull()
  })
})
