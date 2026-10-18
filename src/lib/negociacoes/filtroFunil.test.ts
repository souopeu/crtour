import { describe, expect, test } from 'vitest'
import { filtrarNegociacoes, hrefFunil, lerFiltroFunil, type FiltroFunil } from './filtroFunil'

const uuid = 'a2000000-0000-4000-8000-000000000001'
const padrao: FiltroFunil = { visao: 'kanban', agrupar: 'etapa', q: '', pessoa: null }

describe('lerFiltroFunil', () => {
  test('uses defaults when empty or invalid', () => {
    expect(lerFiltroFunil({})).toEqual(padrao)
    expect(lerFiltroFunil({ visao: 'x', agrupar: 'y', pessoa: 'nao-uuid', q: ['a', 'b'] })).toEqual(padrao)
  })
  test('reads valid values and trims the search', () => {
    expect(lerFiltroFunil({ visao: 'tabela', agrupar: 'responsavel', q: '  Lisboa ', pessoa: uuid }))
      .toEqual({ visao: 'tabela', agrupar: 'responsavel', q: 'Lisboa', pessoa: uuid })
    expect(lerFiltroFunil({ pessoa: 'sem' }).pessoa).toBe('sem')
    expect(lerFiltroFunil({ q: 'a'.repeat(300) }).q).toHaveLength(100)
  })
})

describe('hrefFunil', () => {
  test('omits defaults', () => {
    expect(hrefFunil(padrao)).toBe('/funil')
  })
  test('keeps search and person when switching views (R60)', () => {
    const f = lerFiltroFunil({ q: 'ana souza', pessoa: uuid, agrupar: 'responsavel' })
    expect(hrefFunil({ ...f, visao: 'tabela' })).toBe(`/funil?visao=tabela&agrupar=responsavel&q=ana+souza&pessoa=${uuid}`)
    expect(hrefFunil({ ...f, visao: 'kanban' })).toBe(`/funil?agrupar=responsavel&q=ana+souza&pessoa=${uuid}`)
  })
})

describe('filtrarNegociacoes', () => {
  const lista = [
    { id: '1', titulo: 'Lisboa em março', cliente_nome: 'Ana Souza', responsavel_id: uuid },
    { id: '2', titulo: 'Noronha em julho', cliente_nome: 'Beto Lima', responsavel_id: null },
    { id: '3', titulo: 'Cruzeiro', cliente_nome: 'José Araújo', responsavel_id: uuid },
  ]
  const ids = (f: Partial<FiltroFunil>) => filtrarNegociacoes(lista, { ...padrao, ...f }).map((n) => n.id)

  test('no filter keeps everything', () => expect(ids({})).toEqual(['1', '2', '3']))
  test('searches title or client, ignoring case and accents', () => {
    expect(ids({ q: 'LISBOA' })).toEqual(['1'])
    expect(ids({ q: 'jose araujo' })).toEqual(['3'])
    expect(ids({ q: 'lima' })).toEqual(['2'])
  })
  test('filters by person in charge, or by nobody in charge', () => {
    expect(ids({ pessoa: uuid })).toEqual(['1', '3'])
    expect(ids({ pessoa: 'sem' })).toEqual(['2'])
    expect(ids({ pessoa: uuid, q: 'cruz' })).toEqual(['3'])
  })
})
