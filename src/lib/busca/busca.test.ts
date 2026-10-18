import { describe, expect, it } from 'vitest'
import { agrupar, atalhoAbreBusca, hrefResultado, hrefVerTodos, termoValido } from './busca'

const tecla = (key: string, alvo: { tagName?: string; isContentEditable?: boolean } | null = { tagName: 'BODY' }, mods = {}) =>
  atalhoAbreBusca({ key, ctrlKey: false, metaKey: false, altKey: false, ...mods }, alvo)

describe('atalhoAbreBusca', () => {
  it('opens on "/" outside text fields', () => {
    expect(tecla('/')).toBe(true)
    expect(tecla('/', null)).toBe(true)
    expect(tecla('/', { tagName: 'A' })).toBe(true)
  })

  it('never fires while the person is typing or with a modifier', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) expect(tecla('/', { tagName })).toBe(false)
    expect(tecla('/', { tagName: 'DIV', isContentEditable: true })).toBe(false)
    expect(tecla('/', { tagName: 'BODY' }, { ctrlKey: true })).toBe(false)
    expect(tecla('/', { tagName: 'BODY' }, { metaKey: true })).toBe(false)
    expect(tecla('a')).toBe(false)
  })
})

describe('termoValido', () => {
  it('needs 2 letters after trimming and caps the length', () => {
    expect(termoValido(' a ')).toBeNull()
    expect(termoValido('  jo ')).toBe('jo')
    expect(termoValido('x'.repeat(150))).toHaveLength(100)
  })
})

describe('links', () => {
  it('opens each result on its own screen', () => {
    expect(hrefResultado({ tipo: 'cliente', id: 'c1' })).toBe('/clientes/c1')
    expect(hrefResultado({ tipo: 'negociacao', id: 'n1' })).toBe('/negociacoes/n1')
    expect(hrefResultado({ tipo: 'passeio', id: 'p1' })).toBe('/passeios/p1')
  })

  it('"see all" carries the term to the list that has a search field', () => {
    expect(hrefVerTodos('cliente', 'ana souza')).toBe('/?q=ana+souza')
    expect(hrefVerTodos('negociacao', 'lua&mel')).toBe('/funil?q=lua%26mel')
    expect(hrefVerTodos('passeio', 'gramado')).toBeNull()
  })
})

describe('agrupar', () => {
  it('keeps the order Clientes, Negociações, Passeios and drops empty groups', () => {
    const grupos = agrupar([
      { tipo: 'passeio', id: 'p1', titulo: 'Gramado', detalhe: null, data: null },
      { tipo: 'cliente', id: 'c1', titulo: 'Ana', detalhe: null, data: null },
      { tipo: 'cliente', id: 'c2', titulo: 'Beto', detalhe: null, data: null },
    ])
    expect(grupos.map((g) => [g.rotulo, g.itens.length])).toEqual([['Clientes', 2], ['Passeios', 1]])
  })
})
