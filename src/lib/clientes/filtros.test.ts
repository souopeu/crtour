import { describe, expect, test } from 'vitest'
import { POR_PAGINA, hrefDaLista, lerFiltros, resumoDaPagina } from './filtros'

const uuid = 'a2000000-0000-4000-8000-000000000001'

describe('lerFiltros', () => {
  test('uses defaults when empty', () => {
    expect(lerFiltros({})).toEqual({ q: '', etiqueta: null, origem: null, cidade: '', estado: '', pagina: 1, visao: 'tabela' })
  })

  test('reads valid values and trims text', () => {
    expect(lerFiltros({ q: '  ana ', etiqueta: uuid, origem: 'instagram', cidade: ' Santos ', estado: ' SP ', pagina: '3', visao: 'cartoes' })).toEqual({
      q: 'ana', etiqueta: uuid, origem: 'instagram', cidade: 'Santos', estado: 'SP', pagina: 3, visao: 'cartoes',
    })
  })

  test('ignores invalid values instead of failing', () => {
    const f = lerFiltros({ etiqueta: 'nao-uuid', origem: 'tv', pagina: '-4', q: ['a', 'b'], visao: 'grade' })
    expect(f).toEqual({ q: '', etiqueta: null, origem: null, cidade: '', estado: '', pagina: 1, visao: 'tabela' })
  })

  test('caps absurd page numbers and long text', () => {
    expect(lerFiltros({ pagina: '99999999' }).pagina).toBe(10000)
    expect(lerFiltros({ q: 'a'.repeat(300) }).q).toHaveLength(100)
  })
})

describe('hrefDaLista', () => {
  test('omits empty filters and the first page', () => {
    expect(hrefDaLista({ q: '', etiqueta: null, origem: null, cidade: '', estado: '', pagina: 1, visao: 'tabela' })).toBe('/')
  })
  test('encodes the filters', () => {
    const href = hrefDaLista({ q: 'ana souza', etiqueta: null, origem: 'site', cidade: 'São Paulo', estado: 'SP', pagina: 2, visao: 'tabela' })
    expect(href).toBe('/?q=ana+souza&origem=site&cidade=S%C3%A3o+Paulo&estado=SP&pagina=2')
  })
  test('keeps the cards view and the filters together (R60)', () => {
    expect(hrefDaLista({ q: 'ana', etiqueta: null, origem: null, cidade: '', estado: '', pagina: 1, visao: 'cartoes' })).toBe('/?q=ana&visao=cartoes')
  })
})

describe('resumoDaPagina', () => {
  test('computes the range and page count', () => {
    expect(resumoDaPagina(60, 2)).toEqual({ de: POR_PAGINA + 1, ate: 50, paginas: 3, temAnterior: true, temProxima: true })
    expect(resumoDaPagina(0, 1)).toEqual({ de: 0, ate: 0, paginas: 1, temAnterior: false, temProxima: false })
    expect(resumoDaPagina(26, 2)).toEqual({ de: 26, ate: 26, paginas: 2, temAnterior: true, temProxima: false })
  })
})
