import { describe, expect, it } from 'vitest'
import { itemAtivo, montarMenu } from './menu'

const hrefs = (menu: ReturnType<typeof montarMenu>) => menu.flatMap((g) => g.itens.map((i) => i.href))
const itemAtivoEm = (menu: ReturnType<typeof montarMenu>, caminho: string) =>
  menu.flatMap((g) => g.itens).filter((i) => itemAtivo(caminho, i))

describe('montarMenu', () => {
  it('groups the entries as Hoje, Vendas, Operação and Gestão, in that order', () => {
    const menu = montarMenu('dono', 0)
    expect(menu.map((g) => g.titulo)).toEqual([undefined, 'Vendas', 'Operação', 'Gestão'])
    expect(menu[0].itens.map((i) => i.rotulo)).toEqual(['Hoje'])
    expect(menu[1].itens.map((i) => i.rotulo)).toEqual(['Funil', 'Clientes', 'Remarketing', 'Campanhas'])
    expect(menu[2].itens.map((i) => i.rotulo)).toEqual(['Passeios', 'Calendário', 'Fornecedores', 'Cobranças', 'Comissões'])
    expect(menu[3].itens.map((i) => i.rotulo)).toEqual(['Painel', 'Avisos', 'Configurações'])
  })

  it('shows Avisos with the unread count only to the owner', () => {
    const dono = montarMenu('dono', 3).flatMap((g) => g.itens).find((i) => i.rotulo === 'Avisos')
    expect(dono?.novos).toBe(3)
    const vendedor = montarMenu('vendedor', 3).flatMap((g) => g.itens)
    expect(vendedor.some((i) => i.rotulo === 'Avisos')).toBe(false)
  })

  it('keeps every route the old top menu had and never repeats a destination', () => {
    const todos = hrefs(montarMenu('dono', 0))
    for (const antigo of ['/hoje', '/', '/funil', '/remarketing', '/passeios', '/cobrancas', '/painel', '/comissoes', '/avisos', '/configuracoes']) {
      expect(todos).toContain(antigo)
    }
    expect(todos).toContain('/fornecedores')
    expect(new Set(todos).size).toBe(todos.length)
  })

  it('gives each entry an icon so the collapsed menu still shows something', () => {
    for (const item of montarMenu('dono', 0).flatMap((g) => g.itens)) expect(item.icone).toBeTruthy()
  })
})

describe('itemAtivo', () => {
  const menu = montarMenu('dono', 0)

  it.each([
    ['/', 'Clientes'],
    ['/clientes/abc', 'Clientes'],
    ['/clientes/novo', 'Clientes'],
    ['/importar', 'Clientes'],
    ['/importar/reservas', 'Clientes'],
    ['/hoje', 'Hoje'],
    ['/funil', 'Funil'],
    ['/negociacoes/9', 'Funil'],
    ['/remarketing/3/editar', 'Remarketing'],
    ['/passeios/novo', 'Passeios'],
    ['/saidas/1/passageiros', 'Passeios'],
    ['/reservas/2', 'Passeios'],
    ['/calendario', 'Calendário'],
    ['/fornecedores', 'Fornecedores'],
    ['/cobrancas', 'Cobranças'],
    ['/painel', 'Painel'],
    ['/comissoes', 'Comissões'],
    ['/avisos', 'Avisos'],
    ['/configuracoes', 'Configurações'],
  ])('marks %s as %s and as nothing else', (caminho, esperado) => {
    expect(itemAtivoEm(menu, caminho).map((i) => i.rotulo)).toEqual([esperado])
  })

  it('does not mark a route whose name merely starts like another', () => {
    expect(itemAtivoEm(menu, '/passeios-extra')).toEqual([])
    expect(itemAtivoEm(menu, '/clientesx')).toEqual([])
  })
})
