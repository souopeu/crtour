import { describe, expect, test } from 'vitest'
import { COLUNAS_MODELO_RESERVAS, gerarModeloReservas } from './modeloReservas'
import { lerPlanilhaReservas } from './reservas'

describe('gerarModeloReservas', () => {
  test('our own reader accepts the template and its example rows', async () => {
    const r = await lerPlanilhaReservas(await gerarModeloReservas(), 'modelo-reservas.xlsx', '2026-10-17')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.ignoradas).toEqual([])
    expect(r.erros).toEqual([])
    expect(r.validas.length).toBe(2)
  })
  test('required columns are marked', () => {
    expect(COLUNAS_MODELO_RESERVAS.slice(0, 5)).toEqual(['WhatsApp do cliente', 'E-mail do cliente', 'Passeio*', 'Data da saída*', 'Pessoas*'])
  })
})

describe('lerPlanilhaReservas', () => {
  test('wrong file and empty sheet', async () => {
    expect(await lerPlanilhaReservas(Buffer.from('x'), 'a.txt', '2026-10-17')).toEqual({ ok: false, erro: 'Use um arquivo .xlsx ou .csv.' })
    expect(await lerPlanilhaReservas(Buffer.from('WhatsApp;Passeio;Data da saída;Pessoas\n'), 'a.csv', '2026-10-17'))
      .toEqual({ ok: false, erro: 'A planilha não tem nenhuma reserva (só o cabeçalho ou linhas vazias).' })
  })
  test('CSV rows split into valid and with errors, with the sheet row number', async () => {
    const csv = 'WhatsApp;Passeio;Data da saída;Pessoas;Obs\n(11) 99999-0001;Lisboa;10/03/2027;2;x\n;;;\n123;Lisboa;10/03/2027;1;\n'
    const r = await lerPlanilhaReservas(Buffer.from(csv), 'r.csv', '2026-10-17')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.validas.map((l) => l.linha)).toEqual([2])
    expect(r.erros).toEqual([{ linha: 4, mensagens: ['WhatsApp inválido: use DDD + número, ex.: (11) 99999-0001.'] }])
    expect(r.ignoradas).toEqual(['Obs'])
  })
  test('missing required column', async () => {
    expect(await lerPlanilhaReservas(Buffer.from('WhatsApp;Data da saída;Pessoas\n1;2;3\n'), 'r.csv', '2026-10-17')).toEqual({ ok: false, erro: 'Falta a coluna "Passeio".' })
  })
})
