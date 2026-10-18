export type IconeMenu =
  | 'hoje' | 'funil' | 'clientes' | 'remarketing' | 'campanhas' | 'passeios' | 'calendario' | 'fornecedores'
  | 'cobrancas' | 'comissoes' | 'painel' | 'avisos' | 'configuracoes'

export type ItemMenu = {
  href: string
  rotulo: string
  icone: IconeMenu
  /** Paths that also light this entry (the entry's own href always does). */
  alcance: readonly string[]
  novos?: number
}

export type GrupoMenu = { titulo?: string; itens: ItemMenu[] }

export type PapelMenu = 'dono' | 'vendedor'

const item = (href: string, rotulo: string, icone: IconeMenu, alcance: readonly string[] = [], novos?: number): ItemMenu =>
  ({ href, rotulo, icone, alcance: [href, ...alcance], novos })

export function montarMenu(papel: PapelMenu, avisosNovos: number): GrupoMenu[] {
  return [
    { itens: [item('/hoje', 'Hoje', 'hoje')] },
    {
      titulo: 'Vendas',
      itens: [
        item('/funil', 'Funil', 'funil', ['/negociacoes']),
        item('/', 'Clientes', 'clientes', ['/clientes', '/importar']),
        item('/remarketing', 'Remarketing', 'remarketing'),
        item('/campanhas', 'Campanhas', 'campanhas'),
      ],
    },
    {
      titulo: 'Operação',
      itens: [
        item('/passeios', 'Passeios', 'passeios', ['/saidas', '/reservas']),
        item('/calendario', 'Calendário', 'calendario'),
        item('/fornecedores', 'Fornecedores', 'fornecedores'),
        item('/cobrancas', 'Cobranças', 'cobrancas'),
        item('/comissoes', 'Comissões', 'comissoes'),
      ],
    },
    {
      titulo: 'Gestão',
      itens: [
        item('/painel', 'Painel', 'painel'),
        ...(papel === 'dono' ? [item('/avisos', 'Avisos', 'avisos', [], avisosNovos)] : []),
        item('/configuracoes', 'Configurações', 'configuracoes'),
      ],
    },
  ]
}

// A path belongs to an entry when it equals one of its prefixes or sits below it ("/clientes/1"), never when it only starts alike ("/clientesx").
export function itemAtivo(caminho: string, entrada: ItemMenu): boolean {
  return entrada.alcance.some((prefixo) => (prefixo === '/' ? caminho === '/' : caminho === prefixo || caminho.startsWith(`${prefixo}/`)))
}
