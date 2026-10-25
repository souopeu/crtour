import { describe, expect, it } from 'vitest'
import { alternarGrupo, gravarGruposFechados, grupoAberto, itemAtivo, lerGruposFechados, montarMenu } from './menu'

const hrefs = (menu: ReturnType<typeof montarMenu>) => menu.flatMap((g) => g.itens.map((i) => i.href))
const itemAtivoEm = (menu: ReturnType<typeof montarMenu>, caminho: string) =>
  menu.flatMap((g) => g.itens).filter((i) => itemAtivo(caminho, i))

describe('montarMenu', () => {
  it('puts Hoje, Calendário and Reservas loose on top, then the collapsible groups (R133)', () => {
    const menu = montarMenu('dono', 0)
    expect(menu.map((g) => g.titulo)).toEqual([undefined, 'Vendas', 'Catálogo', 'Operação', 'Financeiro', 'Gestão'])
    expect(menu[0].itens.map((i) => i.rotulo)).toEqual(['Hoje', 'Calendário', 'Reservas'])
    expect(menu[1].itens.map((i) => i.rotulo)).toEqual(['Funil', 'Clientes', 'Remarketing', 'Campanhas'])
    expect(menu[2].itens.map((i) => i.rotulo)).toEqual(['Passeios', 'Fornecedores'])
    expect(menu[3].itens.map((i) => i.rotulo)).toEqual(['Veículos'])
    expect(menu[4].itens.map((i) => i.rotulo)).toEqual(['Cobranças', 'Comissões'])
    expect(menu[5].itens.map((i) => i.rotulo)).toEqual(['Painel', 'Avisos', 'Configurações'])
  })

  it('gives every titled group a stable id and the loose top none', () => {
    const menu = montarMenu('dono', 0)
    expect(menu.map((g) => g.id)).toEqual([undefined, 'vendas', 'catalogo', 'operacao', 'financeiro', 'gestao'])
  })

  it('shows Avisos with the unread count to everyone (R130: reminders are personal)', () => {
    for (const papel of ['dono', 'vendedor'] as const) {
      expect(montarMenu(papel, 3).flatMap((g) => g.itens).find((i) => i.rotulo === 'Avisos')?.novos).toBe(3)
    }
  })

  it('keeps every route the old top menu had and never repeats a destination', () => {
    const todos = hrefs(montarMenu('dono', 0))
    for (const antigo of ['/hoje', '/', '/funil', '/remarketing', '/passeios', '/cobrancas', '/painel', '/comissoes', '/avisos', '/configuracoes']) {
      expect(todos).toContain(antigo)
    }
    expect(todos).toContain('/fornecedores')
    expect(todos).toContain('/calendario')
    expect(todos).toContain('/reservas')
    expect(new Set(todos).size).toBe(todos.length)
  })

  it('shows Atendimento with the unread count only when WhatsApp is connected (R107)', () => {
    expect(hrefs(montarMenu('vendedor', 0))).not.toContain('/atendimento')
    const vendas = montarMenu('vendedor', 0, 4)[1].itens
    expect(vendas[0]).toMatchObject({ href: '/atendimento', rotulo: 'Atendimento', novos: 4 })
    expect(montarMenu('dono', 0, 0)[1].itens[0].novos).toBe(0)
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
    ['/reservas', 'Reservas'],
    ['/reservas/2', 'Reservas'],
    ['/calendario', 'Calendário'],
    ['/fornecedores', 'Fornecedores'],
    ['/veiculos', 'Veículos'],
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

describe('grupos recolhíveis (R133)', () => {
  const menu = montarMenu('dono', 0)
  const [topo, vendas, catalogo] = menu

  it('always shows the loose top entries', () => {
    expect(grupoAberto(topo, '/painel', new Set(['vendas', 'catalogo']))).toBe(true)
  })

  it('opens the group of the current screen even when it was closed', () => {
    expect(grupoAberto(catalogo, '/saidas/1', new Set(['catalogo']))).toBe(true)
  })

  it('keeps the other groups as the person left them', () => {
    expect(grupoAberto(vendas, '/passeios', new Set(['vendas']))).toBe(false)
    expect(grupoAberto(vendas, '/passeios', new Set())).toBe(true)
  })

  it('reads only known group ids from the cookie', () => {
    expect([...lerGruposFechados('vendas,gestao')]).toEqual(['vendas', 'gestao'])
    expect([...lerGruposFechados('vendas,<script>,,catalogo,vendas')]).toEqual(['vendas', 'catalogo'])
    expect(lerGruposFechados(undefined).size).toBe(0)
    expect(lerGruposFechados('x'.repeat(5000)).size).toBe(0)
  })

  it('toggles a group without changing the set it was given', () => {
    const antes = new Set(['vendas'])
    const depois = alternarGrupo(antes, 'gestao')
    expect([...antes]).toEqual(['vendas'])
    expect([...depois].sort()).toEqual(['gestao', 'vendas'])
    expect([...alternarGrupo(depois, 'vendas')]).toEqual(['gestao'])
  })

  it('writes the closed groups back in the cookie format it reads', () => {
    const fechados = new Set(['financeiro', 'vendas'])
    expect(lerGruposFechados(gravarGruposFechados(fechados))).toEqual(fechados)
  })
})
