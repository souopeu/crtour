import { describe, expect, test } from 'vitest'
import { converterLinha } from '@/lib/importacao/linhas'
import { lerPlanilha } from '@/lib/importacao/planilha'
import { escaparCelula, paraCsv } from './csv'

describe('escaparCelula', () => {
  test.each([
    ['=SOMA(A1:A2)', "'=SOMA(A1:A2)"],
    ['+5511999999999', "'+5511999999999"],
    ['-2+3', "'-2+3"],
    ['@usuario', "'@usuario"],
    ['\tcmd', "'\tcmd"],
    ['\rcmd', "'\rcmd"],
  ])('neutralizes formula %j', (entrada, esperado) => {
    expect(escaparCelula(entrada).replace(/^"|"$/g, '')).toBe(esperado)
  })

  test('quotes fields with delimiter, quotes or line breaks', () => {
    expect(escaparCelula('a;b')).toBe('"a;b"')
    expect(escaparCelula('disse "oi"')).toBe('"disse ""oi"""')
    expect(escaparCelula('linha1\nlinha2')).toBe('"linha1\nlinha2"')
  })

  test('leaves plain text, numbers and empty values alone', () => {
    expect(escaparCelula('Ana Souza')).toBe('Ana Souza')
    expect(escaparCelula(42)).toBe('42')
    expect(escaparCelula(null)).toBe('')
    expect(escaparCelula(undefined)).toBe('')
  })
})

describe('paraCsv', () => {
  test('writes BOM, semicolons and CRLF', () => {
    const csv = paraCsv(['Nome', 'Cidade'], [['Ana', 'Santos'], ['Beto', null]])
    expect(csv).toBe('﻿Nome;Cidade\r\nAna;Santos\r\nBeto;\r\n')
  })

  test('round-trips through our own importer', async () => {
    const csv = paraCsv(
      ['Nome*', 'WhatsApp', 'Restrições', 'Etiquetas', 'Consentimento WhatsApp'],
      [['Souza; Ana', '5511999990001', 'disse "oi"\nsem glúten', 'Europa, VIP', 'Aceitou']],
    )
    const r = await lerPlanilha(Buffer.from(csv, 'utf8'), 'export.csv')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const linha = converterLinha(r.linhas[0].numero, r.linhas[0].celulas)
    expect(linha.ok && linha.linha).toMatchObject({
      nome: 'Souza; Ana', whatsapp: '5511999990001', restricoes: 'disse "oi"\nsem glúten',
      etiquetas: ['Europa', 'VIP'], consentimento_whatsapp: 'aceitou',
    })
  })
})
