import { describe, expect, test } from 'vitest'
import { VALORES_VAZIOS, valoresDaLinha, valoresDoForm, type LinhaCliente } from './formulario'

const linha: LinhaCliente = {
  nome: 'Ana', whatsapp: '5511999990001', email: null, cidade: 'Santos', aniversario: '1990-05-17', origem: 'site',
  destinos_interesse: ['Lisboa', 'Paris'], faixa_orcamento: null, qtd_pessoas: 4, restricoes: null,
  passaporte_validade: null, consentimento_whatsapp: 'aceitou',
}

describe('valoresDaLinha', () => {
  test('turns a database row into form strings (null -> empty)', () => {
    expect(valoresDaLinha(linha)).toEqual({
      nome: 'Ana', whatsapp: '5511999990001', email: '', cidade: 'Santos', aniversario: '1990-05-17', origem: 'site',
      destinos: 'Lisboa, Paris', faixaOrcamento: '', qtdPessoas: '4', restricoes: '', passaporteValidade: '', consentimento: 'aceitou',
    })
  })
  test('keeps zero people as "0", not empty', () => {
    expect(valoresDaLinha({ ...linha, qtd_pessoas: 0 }).qtdPessoas).toBe('0')
  })
})

describe('valoresDoForm', () => {
  test('reads every field, missing ones as empty strings', () => {
    const fd = new FormData()
    fd.set('nome', 'Beto')
    fd.set('cidade', 'Rio')
    const v = valoresDoForm(fd)
    expect(v.nome).toBe('Beto')
    expect(v.cidade).toBe('Rio')
    expect(v.whatsapp).toBe('')
    expect(Object.keys(v).sort()).toEqual(Object.keys(VALORES_VAZIOS).sort())
  })
})
